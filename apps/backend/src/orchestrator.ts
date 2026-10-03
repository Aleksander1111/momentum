import { crossProjectFeed } from '@momentum/kb';
import { branchesUnder, commitPathsFrom, deleteBranch, listFiles, removeWorktree, worktreeDirs } from '@momentum/runs';
import { CronExpressionParser } from 'cron-parser';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileOf, KNOWLEDGE_GRAPH } from '@momentum/entity';
import { TRIGGER_TYPE, type Automations, type Trigger } from './automations.ts';
import { config } from './config.ts';
import type { Bus } from './events.ts';
import type { Guard } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import { graphBuildPrompt } from './graph-build.ts';
import { userStarted, type Runner } from './runner.ts';
import { Conflict, type Workspace, type Workspaces } from './workspaces.ts';

const PROMPTS: Record<string, string> = {
  schedule: 'Scheduled run: carry out your responsibility for this workspace now.',
};

/**
 * Starts and supervises the automation loops of every enabled project, from the trigger entities of each workspace.
 * The feed size bounds the scheduled loops; automation runs go one at a time per project, so their changes never
 * conflict, while runs the user starts go at once; a total across projects bounds them all.
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
    bus.on('implementation_finished', ({ workspace, targetPath }) => void this.onEvent(workspace, 'implementation_finished', { targetPath }));
    // Summarization runs as a step and has no trigger entity; artifacts changed on the main line start it directly
    bus.on('artifact_ahead', ({ workspace, entities }) => void this.summarizeMainLine(workspace, entities));
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
    if ((await this.settings.graphBuild(ws.name)).state !== 'complete') await this.settings.setGraphBuild(ws.name, 'building');
    void this.tick();
  }

  /** Disabling a project: a build in progress stops; enabling the project again resumes it */
  async disable(ws: Workspace): Promise<void> {
    if ((await this.settings.graphBuild(ws.name)).state === 'building') {
      await this.runner.stopAutomation(ws.name, 'graph-build');
      await this.settings.setGraphBuild(ws.name, 'stopped');
    }
  }

  /**
   * Resetting a project: every run ends, run checkouts go, the knowledge graph is deleted from the main line in one
   * commit, and the workspace's index and metrics database is dropped. An enabled project is then enabled afresh:
   * default triggers are proposed again and the knowledge graph is built from the start.
   */
  async reset(ws: Workspace): Promise<void> {
    if (ws.name === config.harnessName) throw new Conflict('The harness workspace holds the automation definitions and cannot be reset');
    const enabled = (await this.settings.enabled()).some((p) => p.name === ws.name);
    // Out of the orchestrator's control while it resets: no loop starts, no event queues a run
    if (enabled) await this.settings.setEnabled(ws.name, false);
    try {
      while (this.ticking) await new Promise((r) => setTimeout(r, 50));
      await this.runner.stopWorkspace(ws.name);
      await this.removeCheckouts(ws);
      const files = await listFiles(ws.path, `refs/heads/${ws.main}`, KNOWLEDGE_GRAPH);
      if (files.length > 0) {
        await commitPathsFrom(ws.path, ws.main, files.map((path) => ({ path, content: null })), 'Reset the knowledge graph');
      }
      await this.workspaces.drop(ws.name);
      await this.settings.resetProject(ws.name);
    } finally {
      if (enabled) await this.settings.setEnabled(ws.name, true);
    }
    if (enabled) await this.enable(await this.workspaces.get(ws.name));
  }

  /** Every run checkout of a workspace, and any momentum/ branch left from before everything went to the main line */
  private async removeCheckouts(ws: Workspace): Promise<void> {
    const runs = resolve(config.runs, ws.name);
    const inRuns = (dir: string) => resolve(dir).toLowerCase().startsWith(runs.toLowerCase());
    for (const dir of (await worktreeDirs(ws.path)).filter(inRuns)) {
      await removeWorktree(ws.path, dir).catch((e) => console.error(`reset ${ws.name}: worktree ${dir}:`, e));
    }
    await rm(runs, { recursive: true, force: true }).catch((e) => console.error(`reset ${ws.name}: ${runs}:`, e));
    for (const branch of await branchesUnder(ws.path, 'momentum/')) {
      if (branch === ws.main) continue;
      await deleteBranch(ws.path, branch).catch((e) => console.error(`reset ${ws.name}: branch ${branch}:`, e));
    }
  }

  /** One summarization run for every entity whose artifacts one main-line change touched */
  private async summarizeMainLine(workspace: string, entities: { path: string; artifacts: string[] }[]): Promise<void> {
    const list = entities.map((e) => `- ${e.path}: ${e.artifacts.join(', ')}`).join('\n');
    await this.runner.create({
      workspace,
      automation: 'summarization',
      trigger: 'event',
      title: `Main line changes (${entities.length})`,
      prompt: `These artifacts changed on the main line. Rewrite the summary and card of each entity from its artifacts:\n\n${list}`,
    });
    const ws = await this.workspaces.get(workspace);
    for (const e of entities) await this.guard.markUpdating(ws, e.path);
    await this.tick();
  }

  /** The user stops the build, or starts it again; the next tick queues the next run while the feed has room */
  async setGraphBuild(ws: Workspace, building: boolean): Promise<void> {
    if (building) {
      if (!(await this.settings.enabled()).some((p) => p.name === ws.name)) throw new Error(`${ws.name} is not enabled`);
      await this.settings.setGraphBuild(ws.name, 'building');
    } else {
      await this.runner.stopAutomation(ws.name, 'graph-build');
      await this.settings.setGraphBuild(ws.name, 'stopped');
    }
  }

  /** One graph build run at a time per workspace, told how much room the feed has */
  private async queueGraphBuild(ws: Workspace, room: number): Promise<void> {
    const { state, progress } = await this.settings.graphBuild(ws.name);
    if (state !== 'building') return;
    if (await this.runner.hasOpenRun(ws.name, 'graph-build')) return;
    await this.runner.create({
      workspace: ws.name,
      automation: 'graph-build',
      trigger: 'event',
      title: 'Knowledge graph',
      prompt: graphBuildPrompt(progress, room),
    });
  }

  /** The default trigger entities land on the main line unverified and wait in the feed like any other change */
  private async proposeTriggers(ws: Workspace): Promise<void> {
    if ((await ws.index.byType(TRIGGER_TYPE)).length > 0) return;
    const defaults = await this.automations.defaultTriggers();
    if (defaults.length === 0) return;
    await commitPathsFrom(ws.path, ws.main, defaults.map((t) => ({ path: fileOf(t.path), content: t.text })), 'Add the default triggers');
    await this.guard.indexMainLine(ws);
  }

  private async onEvent(workspace: string, event: string, payload: { targetPath?: string | null }): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    if (!(await this.settings.enabled()).some((p) => p.name === workspace)) return;
    for (const t of await this.automations.triggers(ws)) {
      if (!t.events.includes(event)) continue;
      await this.runner.create({
        workspace,
        automation: t.automation,
        trigger: 'event',
        targetPath: payload.targetPath ?? null,
        prompt:
          event === 'entity_ahead'
            ? `The entity ${payload.targetPath} was approved and nothing implements it yet. Implement it.`
            : `An implementation${payload.targetPath ? ` of ${payload.targetPath}` : ''} finished and landed on the main line. Validate it and raise an issue for anything that fails.`,
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

  /**
   * One pass: main lines indexed, scheduled loops queued while the feed has room, queued runs started within the total;
   * an automation run waits while another automation run of its project is active, a run the user started does not
   */
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
          await this.queueGraphBuild(ws, room);
        }
      }
      const names = new Set(enabled.map((w) => w.name));
      for (const q of await this.runner.queued()) {
        if (!names.has(q.workspace)) continue;
        if (this.runner.activeCount() >= values.agents.concurrentTotal) break;
        if (!userStarted(q.trigger) && this.runner.activeAutomationCount(q.workspace) > 0) continue;
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
