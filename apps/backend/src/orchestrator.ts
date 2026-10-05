import { crossProjectFeed } from '@momentum/kb';
import { commitPathsFrom, listFiles, nonLinear, removeWorktree, worktreeDirs } from '@momentum/runs';
import { CronExpressionParser } from 'cron-parser';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileOf, KNOWLEDGE_GRAPH } from '@momentum/entity';
import { HARNESS_ONLY, TRIGGER_TYPE, type Automations, type Trigger } from './automations.ts';
import { config } from './config.ts';
import type { Bus, Moved } from './events.ts';
import type { Guard } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import { graphBuildPrompt } from './graph-build.ts';
import { userStarted, type Runner } from './runner.ts';
import type { Timeline } from './timeline.ts';
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
    private readonly timeline: Timeline,
  ) {
    bus.on('entity_ahead', ({ workspace, path }) => void this.onEvent(workspace, 'entity_ahead', { targetPath: path }));
    bus.on('implementation_finished', ({ workspace, targetPath }) => void this.onEvent(workspace, 'implementation_finished', { targetPath }));
    // Summarization runs as a step and has no trigger entity; artifacts changed on the main line start it directly
    bus.on('artifact_ahead', ({ workspace, entities, added, deleted, moved }) => void this.summarizeMainLine(workspace, entities, added, deleted, moved));
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
    await this.assertLinear(ws.name, ws.path);
    await this.automations.materialize(ws);
    await this.guard.indexMainLine(ws, true);
    await this.proposeTriggers(ws);
    const { state } = await this.settings.graphBuild(ws.name);
    if (state !== 'complete' && !(state === 'stopped' && (await this.stoppedByUser(ws.name)))) await this.settings.setGraphBuild(ws.name, 'building');
    void this.tick();
  }

  /** The user stopped the build themselves: it stays stopped until they start it, whatever switches the project off and on */
  private async stoppedByUser(workspace: string): Promise<boolean> {
    const [last] = await this.workspaces.sql<{ kind: string; actor: string }[]>`select kind, actor from harness.timeline_event
      where workspace = ${workspace} and kind in ('graph_build_started', 'graph_build_stopped', 'project_reset')
      order by at desc, id desc limit 1`;
    return last?.kind === 'graph_build_stopped' && last.actor === 'user';
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

  /** Every run checkout of a workspace */
  private async removeCheckouts(ws: Workspace): Promise<void> {
    const runs = resolve(config.runs, ws.name);
    const inRuns = (dir: string) => resolve(dir).toLowerCase().startsWith(runs.toLowerCase());
    for (const dir of (await worktreeDirs(ws.path)).filter(inRuns)) {
      await removeWorktree(ws.path, dir).catch((e) => console.error(`reset ${ws.name}: worktree ${dir}:`, e));
    }
    await rm(runs, { recursive: true, force: true }).catch((e) => console.error(`reset ${ws.name}: ${runs}:`, e));
  }

  /**
   * Before a project is enabled: refused unless it is one straight line, and its main line taken as it stands, merge
   * commits already in its history included
   */
  async acceptLine(ws: Workspace): Promise<void> {
    await this.assertLinear(ws.name, ws.path);
    await this.guard.indexMainLine(ws, true);
  }

  /** Refuses a project that is not one straight line: momentum works on one line, one change after another */
  async assertLinear(name: string, path: string): Promise<void> {
    const reasons = await nonLinear(path);
    if (reasons.length > 0) throw new Conflict(`${name} is not one straight line: ${reasons.join('; ')}. Momentum works on one line only.`);
  }

  /**
   * An enabled project that stopped being one straight line, by a branch, a detached HEAD or a merge, is switched
   * off at once and says why; nothing of it runs until the user makes it one line again and enables it
   */
  private async keptLinear(ws: Workspace): Promise<boolean> {
    const reasons = await nonLinear(ws.path, await this.settings.indexedCommit(ws.name)).catch((e: Error) => [e.message]);
    if (reasons.length === 0) return true;
    await this.settings.setEnabled(ws.name, false);
    await this.disable(ws);
    await this.timeline.record({
      workspace: ws.name,
      actor: 'harness',
      kind: 'project_disabled',
      title: `Disabled ${ws.name}: it is not one straight line`,
      detail: `${reasons.join('; ')}. Momentum works on one line only: remove what is not, then enable it again.`,
    });
    return false;
  }

  /**
   * One summarization run for every entity whose artifacts one main-line change touched, and for the files it added
   * that no entity summarizes
   */
  private async summarizeMainLine(
    workspace: string,
    entities: { path: string; artifacts: string[] }[],
    added: string[] = [],
    deleted: string[] = [],
    moved: Moved[] = [],
  ): Promise<void> {
    const marked = (a: string) => {
      const m = moved.find((x) => x.from === a);
      if (m) return `${a} (moved to ${m.to}${m.unchanged ? ', content unchanged' : ''})`;
      return deleted.includes(a) ? `${a} (deleted)` : a;
    };
    const parts = [
      ...(entities.length
        ? [
            `These artifacts changed on the main line. Rewrite the summary and card of each entity from its artifacts; an artifact marked deleted is gone from what the knowledge graph summarizes, deleted from the repository or moved where nothing is summarized (an archive, for one): treat it as deleted even when git shows it moved, and never list it under a new path; one marked moved is listed under its new path from now on:\n\n${entities.map((e) => `- ${e.path}: ${e.artifacts.map(marked).join(', ')}`).join('\n')}`,
          ]
        : []),
      ...(added.length
        ? [`These files were added on the main line and no entity summarizes them yet. Summarize them into entities, new ones or ones that already cover what they do:\n\n${added.map((f) => `- ${f}`).join('\n')}`]
        : []),
    ];
    await this.runner.create({
      workspace,
      automation: 'summarization',
      trigger: 'event',
      title: `Main line changes (${entities.length + added.length})`,
      prompt: parts.join('\n\n'),
      targets: entities.map((e) => e.path),
    });
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
  private async queueGraphBuild(ws: Workspace, projects: string[]): Promise<void> {
    const { state, progress } = await this.settings.graphBuild(ws.name);
    if (state !== 'building') return;
    if (await this.runner.hasOpenRun(ws.name, 'graph-build')) return;
    // The room as it is now: the feed's size or what fills it may have changed while the tick indexed
    const { feedSize } = await this.settings.values();
    const room = feedSize - (await crossProjectFeed(this.workspaces.sql, projects, feedSize)).length;
    if (room <= 0) return;
    await this.runner.create({
      workspace: ws.name,
      automation: 'graph-build',
      trigger: 'event',
      title: 'Knowledge graph',
      prompt: graphBuildPrompt(progress, room),
    });
  }

  /**
   * The default trigger entities land on the main line unverified and wait in the feed like any other change; an
   * automation of the harness alone is triggered in the harness workspace only
   */
  private async proposeTriggers(ws: Workspace): Promise<void> {
    if ((await ws.index.byType(TRIGGER_TYPE)).length > 0) return;
    const harness = ws.name === config.harnessName;
    const defaults = (await this.automations.defaultTriggers()).filter(
      (t) => harness || !HARNESS_ONLY.some((a) => t.path === `${TRIGGER_TYPE}/${a}`),
    );
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
      // Repositories cloned under the root or removed from it since the last pass
      await this.settings.discover().catch((e) => console.error('discover projects:', e));
      const enabled = [];
      for (const ws of await this.workspaces.enabled()) if (await this.keptLinear(ws)) enabled.push(ws);
      for (const ws of enabled) await this.guard.indexMainLine(ws).catch((e) => console.error(`index ${ws.name}:`, e));
      const values = await this.settings.values();
      const feed = await crossProjectFeed(this.workspaces.sql, enabled.map((w) => w.name), values.feedSize);
      const room = values.feedSize - feed.length;
      if (room > 0) {
        for (const ws of enabled) {
          for (const t of await this.automations.triggers(ws)) {
            if (!t.schedule || (await this.runner.hasOpenRun(ws.name, t.automation))) continue;
            if (!this.due(t, await this.runner.lastStart(ws.name, t.automation))) continue;
            await this.runner.create({ workspace: ws.name, automation: t.automation, trigger: 'schedule', prompt: PROMPTS.schedule! });
          }
          await this.queueGraphBuild(ws, enabled.map((w) => w.name));
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
