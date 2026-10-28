import type {
  AskResponse,
  Attachment,
  AutomationName,
  ChatsResponse,
  ContextItem,
  EntityDetail,
  EntityStates,
  FeedResponse,
  GraphBuildStatus,
  PutGraphBuild,
  MetricsRange,
  MetricsResponse,
  PutSettings,
  RunDetail,
  SearchResult,
  Settings,
  TimelineQuery,
  TimelineResponse,
  ActiveRunsQuery,
  ActiveRunsResponse,
  TypesResponse,
  Workspace as WorkspaceView,
} from '@momentum/contract';
import { crossProjectEntityCounts, crossProjectFeed, type Embed, type Sql } from '@momentum/kb';
import { show } from '@momentum/runs';
import { Answers } from './answer.ts';
import { attachmentFile, attachments } from './attachments.ts';
import type { Approval } from './approval.ts';
import type { Automations } from './automations.ts';
import type { HarnessSettings } from './harness.ts';
import { graphBuildStatus } from './graph-build.ts';
import { acceptPattern, detectPatterns, PATTERN_TYPE, workspaceMetrics } from './metrics.ts';
import type { Orchestrator } from './orchestrator.ts';
import type { Runner } from './runner.ts';
import { addStates, automationLabel, conversational, measured, stateCounts, type Timeline } from './timeline.ts';
import { NotFound, type Workspaces } from './workspaces.ts';

/** Settings as the timeline names them when the user changes them */
const SETTING_LABEL = {
  feedSize: 'the feed size',
  cards: 'the card rules',
  summarization: 'the summarization exclusions',
  lifetimes: 'the lifetimes',
  agents: 'the total of runs',
  models: 'the models',
} satisfies Partial<Record<keyof Settings, string>>;

/** Every capability of the harness, shared by the HTTP API and its MCP surface */
export class Momentum {
  constructor(
    readonly sql: Sql,
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly approval: Approval,
    private readonly runner: Runner,
    private readonly orchestrator: Orchestrator,
    private readonly automations: Automations,
    private readonly embed: Embed,
    readonly timeline: Timeline,
  ) {
    this.answers = new Answers(workspaces, embed, async () => (await settings.values()).models);
  }

  private readonly answers: Answers;

  /** What happened in the harness, newest first */
  events(q: TimelineQuery): Promise<TimelineResponse> {
    return this.timeline.list(q);
  }

  /** What is queued and running, which the timeline shows only once it ends */
  async activeRuns(q: ActiveRunsQuery): Promise<ActiveRunsResponse> {
    return { runs: await this.runner.underWay(q.workspace) };
  }

  /** The automation and title of a run, for the events about it */
  private async runOf(id: string): Promise<{ workspace: string; automation: string; title: string }> {
    const ws = await this.runner.workspaceOf(id);
    const [r] = await ws.index.sql<{ automation: string; title: string }[]>`
      select automation, title from ${ws.index.sql(`${ws.index.schema}.run`)} where id = ${id}`;
    if (!r) throw new NotFound(`No run ${id}`);
    return { workspace: ws.name, ...r };
  }

  /** The repositories under the root as they are now: one cloned a moment ago is listed, one removed is not */
  async workspaceList(): Promise<WorkspaceView[]> {
    return this.settings.discover();
  }

  async setProjectLogo(name: string, logo: string | null): Promise<WorkspaceView> {
    if (!(await this.settings.setLogo(name, logo))) throw new NotFound(`No workspace ${name}`);
    await this.timeline.record({
      workspace: name,
      actor: 'user',
      kind: 'logo_changed',
      title: logo ? `Changed the logo of ${name}` : `Removed the logo of ${name}`,
    });
    return (await this.settings.projects()).find((p) => p.name === name)!;
  }

  async feed(): Promise<FeedResponse> {
    const enabled = await this.settings.enabled();
    const { feedSize } = await this.settings.values();
    const names = enabled.map((p) => p.name);
    const [items, counts] = await Promise.all([crossProjectFeed(this.sql, names, feedSize), crossProjectEntityCounts(this.sql, names)]);
    return { items, counts };
  }

  async approve(workspace: string, path: string, timeSpentMs: number, version?: string): Promise<void> {
    await this.approval.approve(workspace, path, timeSpentMs, version);
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (row?.type === PATTERN_TYPE) await acceptPattern(ws, path);
    // A pattern found is proposed in the feed: the next tick indexes it. The approval stands whatever becomes of it
    else if (row) {
      const proposed = await detectPatterns(ws, row.type).catch((e: Error) => {
        console.error(`patterns of ${row.type} in ${workspace}:`, e);
        return false;
      });
      if (proposed) void this.orchestrator.tick();
    }
  }

  async sendBack(workspace: string, path: string, comment: string, timeSpentMs: number): Promise<{ runId: string }> {
    const runId = await this.approval.sendBack(workspace, path, comment, timeSpentMs);
    void this.orchestrator.tick();
    return { runId };
  }

  async resolve(
    workspace: string,
    path: string,
    choice: { option?: number; comment?: string },
    timeSpentMs: number,
    version?: string,
  ): Promise<{ runId: string }> {
    const runId = await this.approval.resolve(workspace, path, choice, timeSpentMs, version);
    void this.orchestrator.tick();
    return { runId };
  }

  async wontResolve(workspace: string, path: string, reason: string, timeSpentMs: number): Promise<void> {
    await this.approval.wontResolve(workspace, path, reason, timeSpentMs);
  }

  async entity(workspace: string, path: string): Promise<EntityDetail> {
    const d = await (await this.workspaces.get(workspace)).index.detail(path);
    if (!d) throw new NotFound(`No entity ${path} in ${workspace}`);
    return d;
  }

  /** A repository file as it stands on the main line, such as an interview's document */
  async artifact(workspace: string, path: string): Promise<{ path: string; text: string }> {
    const ws = await this.workspaces.get(workspace);
    const text = await show(ws.path, `refs/heads/${ws.main}`, path);
    if (text === null) throw new NotFound(`No ${path} on the main line of ${workspace}`);
    return { path, text };
  }

  async types(workspace: string): Promise<TypesResponse> {
    return { workspace, ...(await (await this.workspaces.get(workspace)).index.types()) };
  }

  async search(workspace: string, q: string): Promise<{ results: SearchResult[] }> {
    const ws = await this.workspaces.get(workspace);
    if (!q.trim()) return { results: [] };
    const [embedding] = await this.embed([q]);
    return { results: await ws.index.search(q, embedding ?? null) };
  }

  /** A question asked of the knowledge graph, answered in one pass from what the search finds, every entity it draws from linked */
  ask(workspace: string, question: string): Promise<AskResponse> {
    return this.answers.ask(workspace, question);
  }

  async chats(workspace: string): Promise<ChatsResponse> {
    const ws = await this.workspaces.get(workspace);
    const s = ws.index.schema;
    const rows = await ws.index.sql.unsafe<
      {
        run_id: string;
        title: string;
        first: string | null;
        outcome: string | null;
        automation: ChatsResponse['chats'][number]['automation'];
        status: ChatsResponse['chats'][number]['status'];
        updated_at: Date;
        entity_path: string | null;
        moves: EntityStates[];
      }[]
    >(
      `select r.id as run_id, r.title, r.automation, r.status,
         (select text from ${s}.run_message m where m.run_id = r.id and m.role = 'user' order by seq limit 1) as first,
         (select t.title from harness.timeline_event t where t.run_id = r.id and t.actor = 'automation') as outcome,
         greatest(r.created_at, r.ended_at, (select max(at) from ${s}.run_message m where m.run_id = r.id)) as updated_at,
         e.path as entity_path,
         (select coalesce(jsonb_agg(t.facts->'states'), '[]') from harness.timeline_event t
           where t.run_id = r.id and t.facts->'states' is not null) as moves
       from ${s}.run r
       left join ${s}.chat c on c.run_id = r.id
       left join ${s}.entity e on e.path = coalesce(c.entity_path, r.target_path)
       where (c.run_id is not null or exists (select 1 from ${s}.run_message m where m.run_id = r.id))
       order by updated_at desc`,
    );
    return {
      chats: rows.map((r) => ({
        workspace,
        runId: r.run_id,
        // A chat reads by its name, what was done in it, and an interview by its topic; an automation's run by what came
        // of it, as the timeline says
        title: (conversational(r.automation) ? r.title : r.outcome || r.title) || (r.first ?? '').split('\n')[0]!.slice(0, 80),
        automation: r.automation,
        status: r.status,
        updatedAt: r.updated_at.toISOString(),
        entityPath: r.entity_path,
        // The run's own event and every reaction made in it, summed as the timeline shows each
        states: r.moves.reduce<EntityStates>((sum, m) => addStates(sum, m), {}),
      })),
    };
  }

  async createChat(workspace: string, text: string, targetPath?: string, context: ContextItem[] = [], attached: string[] = []): Promise<{ runId: string }> {
    const ws = await this.workspaces.get(workspace);
    const files = await attachments.of(workspace, attached);
    // Named after the first prompt until the chat names itself after what was done in it
    const title = text.split('\n')[0]!.slice(0, 80);
    // A chat on an entity marks it updating
    const [runId, states] = await measured(ws.index, () =>
      this.runner.create({
        workspace,
        automation: 'chat',
        trigger: 'on_demand',
        prompt: text,
        title,
        targetPath: targetPath ?? null,
        context,
        attachments: files,
      }),
    );
    await this.timeline.record({
      workspace,
      actor: 'user',
      kind: 'chat_started',
      title: 'Started a chat',
      detail: text,
      runId,
      automation: 'chat',
      path: targetPath ?? null,
      facts: { runTitle: title, ...(Object.keys(states).length ? { states } : {}) },
    });
    void this.orchestrator.tick();
    return { runId };
  }

  /**
   * An interview: one question at a time, each answer written into a document, which becomes entities when it is done.
   * Started by the user like a chat, so it runs at once.
   */
  async startInterview(workspace: string, topic: string): Promise<{ runId: string }> {
    await this.workspaces.get(workspace);
    const prompt = `Interview: ${topic}`;
    const runId = await this.runner.create({ workspace, automation: 'interview', trigger: 'on_demand', prompt, title: prompt.slice(0, 80) });
    await this.timeline.record({
      workspace,
      actor: 'user',
      kind: 'interview_started',
      title: 'Started an interview',
      detail: topic,
      runId,
      automation: 'interview',
      facts: { runTitle: prompt.slice(0, 80) },
    });
    void this.orchestrator.tick();
    return { runId };
  }

  /**
   * Starts an automation whose trigger entity allows starting on demand, for the workspace or for one entity, such as
   * an implementation started again after it failed
   */
  async runAutomation(workspace: string, automation: AutomationName, prompt?: string, targetPath?: string): Promise<{ runId: string }> {
    const ws = await this.workspaces.get(workspace);
    const trigger = (await this.automations.triggers(ws)).find((t) => t.automation === automation);
    if (!trigger?.on_demand) throw new NotFound(`${automation} does not start on demand in ${workspace}`);
    const target = targetPath ? await ws.index.row(targetPath) : null;
    if (targetPath && !target) throw new NotFound(`No entity ${targetPath} in ${workspace}`);
    const runId = await this.runner.create({
      workspace,
      automation,
      trigger: 'on_demand',
      title: target?.title,
      targetPath: targetPath ?? null,
      prompt:
        prompt ??
        (targetPath
          ? `Started on demand by the user for the entity ${targetPath} ("${target!.title}"): carry out your responsibility for it now.`
          : 'Started on demand by the user: carry out your responsibility for this workspace now.'),
    });
    void this.orchestrator.tick();
    return { runId };
  }

  run(id: string): Promise<RunDetail> {
    return this.runner.detail(id);
  }

  /** A file to attach to a chat message, kept until a message carries it */
  async attach(workspace: string, name: string, data: string): Promise<Attachment> {
    await this.workspaces.get(workspace);
    return attachments.save(workspace, name, data);
  }

  /** An attached file, for the app to show or open */
  async attachment(workspace: string, id: string): Promise<{ attachment: Attachment; file: string }> {
    await this.workspaces.get(workspace);
    const attachment = await attachments.get(workspace, id);
    return { attachment, file: attachmentFile(workspace, attachment) };
  }

  async postMessage(id: string, text: string, context: ContextItem[] = [], attached: string[] = []): Promise<void> {
    const run = await this.runOf(id);
    const files = await attachments.of(run.workspace, attached);
    await this.timeline.record({
      workspace: run.workspace,
      actor: 'user',
      kind: 'message_sent',
      // A chat's or an interview's event is named as it is
      title: conversational(run.automation) ? run.title || automationLabel(run.automation) : `Steered ${automationLabel(run.automation)}`,
      detail: text,
      runId: id,
      automation: run.automation,
      facts: conversational(run.automation) && run.title ? { runTitle: run.title } : {},
    });
    await this.runner.send(id, text, context, files);
  }

  /** Ends a run: its process is killed; what it wrote so far still passes the guard and reaches the feed */
  async killRun(id: string): Promise<void> {
    await this.runner.workspaceOf(id);
    await this.runner.kill(id, true);
  }

  /** The knowledge graph build of a workspace: state, runs, entities written and everything they used */
  async graphBuild(workspace: string): Promise<GraphBuildStatus> {
    return graphBuildStatus(await this.workspaces.get(workspace), this.settings);
  }

  /** Stops the build or starts it again, and paces it by the feed or has it run in full */
  async setGraphBuild(workspace: string, change: PutGraphBuild): Promise<GraphBuildStatus> {
    const ws = await this.workspaces.get(workspace);
    const { mode, building } = change;
    if (mode !== undefined && mode !== (await this.settings.graphBuild(workspace)).mode) {
      await this.orchestrator.setGraphBuildMode(ws, mode);
      await this.timeline.record({
        workspace,
        actor: 'user',
        kind: 'graph_build_mode_changed',
        title: mode === 'full' ? 'The knowledge graph builds in full, whatever the feed holds' : 'The knowledge graph builds while the feed has room',
        facts: { mode },
      });
    }
    if (building !== undefined) {
      await this.orchestrator.setGraphBuild(ws, building);
      await this.timeline.record({
        workspace,
        actor: 'user',
        kind: building ? 'graph_build_started' : 'graph_build_stopped',
        title: building ? 'Started the knowledge graph build' : 'Stopped the knowledge graph build',
      });
    }
    if (building || mode === 'full') void this.orchestrator.tick();
    return graphBuildStatus(ws, this.settings);
  }

  /** Removes every entity and database entry of a project, then builds its knowledge graph afresh */
  async resetProject(workspace: string): Promise<GraphBuildStatus> {
    const ws = await this.workspaces.get(workspace);
    const before = await stateCounts(ws.index);
    await this.orchestrator.reset(ws);
    const states = addStates(await stateCounts((await this.workspaces.get(workspace)).index), before, -1);
    await this.timeline.record({
      workspace,
      actor: 'user',
      kind: 'project_reset',
      title: `Reset ${workspace}: its knowledge graph builds afresh`,
      facts: Object.keys(states).length ? { states } : {},
    });
    void this.orchestrator.tick();
    return graphBuildStatus(await this.workspaces.get(workspace), this.settings);
  }

  async metrics(workspace: string, range: MetricsRange = '30d'): Promise<MetricsResponse> {
    return workspaceMetrics(await this.workspaces.get(workspace), this.automations, range);
  }

  async getSettings(): Promise<Settings> {
    await this.settings.discover();
    return this.settings.get();
  }

  async putSettings(change: PutSettings): Promise<Settings> {
    const previous = await this.settings.get();
    const before = new Set((await this.settings.enabled()).map((p) => p.name));
    // Only a project that is one straight line can be enabled
    for (const p of change.projects ?? []) {
      if (!p.enabled || before.has(p.name)) continue;
      if (previous.projects.some((x) => x.name === p.name)) await this.orchestrator.acceptLine(await this.workspaces.get(p.name));
    }
    const after = await this.settings.put(change);
    for (const p of after.projects) {
      const kind = p.enabled && !before.has(p.name) ? 'project_enabled' : !p.enabled && before.has(p.name) ? 'project_disabled' : null;
      if (!kind) continue;
      await this.timeline.record({ workspace: p.name, actor: 'user', kind, title: `${p.enabled ? 'Enabled' : 'Disabled'} ${p.name}` });
      if (p.enabled) await this.orchestrator.enable(await this.workspaces.get(p.name));
      else await this.orchestrator.disable(await this.workspaces.get(p.name));
    }
    const changed = (Object.keys(SETTING_LABEL) as (keyof typeof SETTING_LABEL)[]).filter(
      (k) => JSON.stringify(previous[k]) !== JSON.stringify(after[k]),
    );
    if (changed.length) {
      await this.timeline.record({
        actor: 'user',
        kind: 'settings_changed',
        title: `Changed ${changed.map((k) => SETTING_LABEL[k]).join(', ')}`,
        detail: changed.map((k) => `${SETTING_LABEL[k]}: ${JSON.stringify(after[k])}`).join('\n'),
        facts: { changed },
      });
    }
    void this.orchestrator.tick();
    return after;
  }
}
