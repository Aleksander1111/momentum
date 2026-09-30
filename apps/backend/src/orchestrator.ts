import { crossProjectFeed } from '@momentum/kb';
import { addWorktree, commitAll } from '@momentum/runs';
import { CronExpressionParser } from 'cron-parser';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileOf } from '@momentum/entity';
import { TRIGGER_TYPE, type Automations, type Trigger } from './automations.ts';
import { config } from './config.ts';
import type { Bus } from './events.ts';
import type { Guard } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import { mappingBranch, mappingPrompt } from './mapping.ts';
import type { Runner } from './runner.ts';
import type { Workspace, Workspaces } from './workspaces.ts';

const PROMPTS: Record<string, string> = {
  schedule: 'Scheduled run: carry out your responsibility for this workspace now.',
};

/**
 * Starts and supervises the automation loops of every enabled project, from the trigger entities of each workspace;
 * the feed size bounds the scheduled loops and a semaphore bounds concurrency.
 */
export class Orchestrator {
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private again = false;

  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly guard: Guard,
    private readonly runner: Runner,
    private readonly automations: Automations,
    private readonly bus: Bus,
  ) {
    bus.on('entity_ahead', ({ workspace, path }) => void this.onEvent(workspace, 'entity_ahead', { targetPath: path }));
    bus.on('implementation_finished', ({ workspace, branch, targetPath }) =>
      void this.onEvent(workspace, 'implementation_finished', { branch, targetPath }),
    );
    // Summarization runs as a step and has no trigger entity; an artifact change starts it directly
    bus.on('artifact_ahead', ({ workspace, path }) =>
      void this.runner
        .create({ workspace, automation: 'summarization', trigger: 'event', targetPath: path, prompt: `The artifact under ${path} changed: rewrite its summary and card from the artifact.` })
        .then(() => this.tick()),
    );
    bus.on('definition_approved', () => void this.automations.materializeAll());
    bus.on('run_ended', () => void this.tick());
    bus.on('feed_changed', () => void this.tick());
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), config.tickMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Enabling a project: definitions materialized, index built, default triggers proposed through the feed, and the
   * knowledge graph starts building unless it is already complete
   */
  async enable(ws: Workspace): Promise<void> {
    await this.automations.materialize(ws);
    await this.guard.indexMainLine(ws);
    await this.proposeTriggers(ws);
    if ((await this.settings.mapping(ws.name)).state !== 'complete') await this.settings.setMapping(ws.name, 'building');
    void this.tick();
  }

  /** Disabling a project: a build in progress stops; enabling the project again resumes it */
  async disable(ws: Workspace): Promise<void> {
    if ((await this.settings.mapping(ws.name)).state === 'building') {
      await this.runner.stopAutomation(ws.name, 'mapping');
      await this.settings.setMapping(ws.name, 'stopped');
    }
  }

  /** The user stops the build, or starts it again; the next tick queues the next run while the feed has room */
  async setMapping(ws: Workspace, building: boolean): Promise<void> {
    if (building) {
      if (!(await this.settings.enabled()).some((p) => p.name === ws.name)) throw new Error(`${ws.name} is not enabled`);
      await this.settings.setMapping(ws.name, 'building');
    } else {
      await this.runner.stopAutomation(ws.name, 'mapping');
      await this.settings.setMapping(ws.name, 'stopped');
    }
  }

  /** One mapping run at a time per workspace, on the workspace's mapping branch, told how much room the feed has */
  private async queueMapping(ws: Workspace, room: number): Promise<void> {
    const { state, progress } = await this.settings.mapping(ws.name);
    if (state !== 'building') return;
    const branch = mappingBranch(ws);
    if ((await this.runner.hasOpenRun(ws.name, 'mapping')) || (await this.runner.hasOpenRunOnBranch(ws.name, branch))) return;
    await this.runner.create({
      workspace: ws.name,
      automation: 'mapping',
      trigger: 'event',
      branch,
      title: 'Knowledge graph',
      prompt: mappingPrompt(progress, room),
    });
  }

  private async proposeTriggers(ws: Workspace): Promise<void> {
    if ((await ws.index.byType(TRIGGER_TYPE)).length > 0) return;
    const defaults = await this.automations.defaultTriggers();
    if (defaults.length === 0) return;
    const id = randomBytes(4).toString('hex');
    const branch = `momentum/setup/${id}`;
    const checkout = join(config.runs, ws.name, id);
    await addWorktree(ws.path, checkout, branch, `refs/heads/${ws.main}`);
    for (const t of defaults) {
      const file = join(checkout, fileOf(t.path));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, t.text, 'utf8');
    }
    await commitAll(checkout, 'momentum: default triggers');
    await this.workspaces.sql`insert into harness.run_ref ${this.workspaces.sql({ id, workspace: ws.name })}`;
    await ws.index.sql`insert into ${ws.index.sql(`${ws.index.schema}.run`)} ${ws.index.sql({
      id,
      automation: 'setup',
      branch,
      checkout,
      trigger: 'event',
      status: 'finished',
      title: 'Default triggers',
      started_at: new Date(),
      ended_at: new Date(),
    })}`;
    await this.guard.transaction({ id, workspace: ws.name, automation: 'setup', branch, checkout, targetPath: null });
  }

  private async onEvent(workspace: string, event: string, payload: { targetPath?: string | null; branch?: string }): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    if (!(await this.settings.enabled()).some((p) => p.name === workspace)) return;
    for (const t of await this.automations.triggers(ws)) {
      if (!t.events.includes(event)) continue;
      await this.runner.create({
        workspace,
        automation: t.automation,
        trigger: 'event',
        targetPath: payload.targetPath ?? null,
        branch: t.automation === 'validation' ? payload.branch : null,
        prompt:
          event === 'entity_ahead'
            ? `The entity ${payload.targetPath} was approved and nothing implements it yet. Implement it.`
            : `The implementation on ${payload.branch} finished${payload.targetPath ? ` for ${payload.targetPath}` : ''}. Validate this branch and report the outcome.`,
      });
    }
    await this.tick();
  }

  private due(t: Trigger, last: Date | null): boolean {
    if (!t.schedule) return false;
    try {
      const prev = CronExpressionParser.parse(t.schedule, { currentDate: new Date() }).prev().toDate();
      return !last || prev > last;
    } catch {
      return false;
    }
  }

  /** One pass: main lines indexed, scheduled loops queued while the feed has room, queued runs started within limits */
  async tick(): Promise<void> {
    if (this.ticking) {
      this.again = true;
      return;
    }
    this.ticking = true;
    try {
      const enabled = await this.workspaces.enabled();
      const values = await this.settings.values();
      for (const ws of enabled) await this.guard.indexMainLine(ws).catch((e) => console.error(`index ${ws.name}:`, e));
      const feed = await crossProjectFeed(this.workspaces.sql, enabled.map((w) => w.name), values.feedSize);
      const room = values.feedSize - feed.length;
      if (room > 0) {
        for (const ws of enabled) {
          for (const t of await this.automations.triggers(ws)) {
            if (!t.schedule || (await this.runner.hasOpenRun(ws.name, t.automation))) continue;
            if (!this.due(t, await this.runner.lastStart(ws.name, t.automation))) continue;
            await this.runner.create({ workspace: ws.name, automation: t.automation, trigger: 'schedule', prompt: PROMPTS.schedule! });
          }
          await this.queueMapping(ws, room);
        }
      }
      const names = new Set(enabled.map((w) => w.name));
      for (const q of await this.runner.queued()) {
        if (!names.has(q.workspace)) continue;
        if (this.runner.activeCount() >= values.agents.concurrentTotal) break;
        if (this.runner.activeCount(q.workspace) >= values.agents.concurrentPerProject) continue;
        await this.runner.start(q.id);
      }
    } catch (e) {
      console.error('orchestrator tick:', e);
    } finally {
      this.ticking = false;
      if (this.again) {
        this.again = false;
        void this.tick();
      }
    }
  }
}
