import type {
  AutomationName,
  ChatsResponse,
  EntityDetail,
  FeedResponse,
  MetricsResponse,
  PutSettings,
  RunDetail,
  SearchResult,
  Settings,
  TypesResponse,
  Workspace as WorkspaceView,
} from '@momentum/contract';
import { crossProjectFeed, type Embed, type Sql } from '@momentum/kb';
import type { Approval } from './approval.ts';
import type { Automations } from './automations.ts';
import type { HarnessSettings } from './harness.ts';
import { detectPatterns, workspaceMetrics } from './metrics.ts';
import type { Orchestrator } from './orchestrator.ts';
import type { Runner } from './runner.ts';
import { NotFound, type Workspaces } from './workspaces.ts';

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
  ) {}

  async workspaceList(): Promise<WorkspaceView[]> {
    return this.settings.projects();
  }

  async feed(): Promise<FeedResponse> {
    const enabled = await this.settings.enabled();
    const { feedSize } = await this.settings.values();
    return { items: await crossProjectFeed(this.sql, enabled.map((p) => p.name), feedSize) };
  }

  async approve(workspace: string, path: string, timeSpentMs: number): Promise<void> {
    await this.approval.approve(workspace, path, timeSpentMs);
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (row) await detectPatterns(ws, row.type);
  }

  async sendBack(workspace: string, path: string, comment: string, timeSpentMs: number): Promise<{ runId: string }> {
    const runId = await this.approval.sendBack(workspace, path, comment, timeSpentMs);
    void this.orchestrator.tick();
    return { runId };
  }

  async entity(workspace: string, path: string): Promise<EntityDetail> {
    const d = await (await this.workspaces.get(workspace)).index.detail(path);
    if (!d) throw new NotFound(`No entity ${path} in ${workspace}`);
    return d;
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

  async chats(workspace: string): Promise<ChatsResponse> {
    const ws = await this.workspaces.get(workspace);
    const s = ws.index.schema;
    const rows = await ws.index.sql.unsafe<
      {
        run_id: string;
        title: string;
        first: string | null;
        automation: ChatsResponse['chats'][number]['automation'];
        status: ChatsResponse['chats'][number]['status'];
        updated_at: Date;
        entity_path: string | null;
        verification: ChatsResponse['chats'][number]['verification'];
        sync: ChatsResponse['chats'][number]['sync'];
      }[]
    >(
      `select r.id as run_id, r.title, r.automation, r.status,
         (select text from ${s}.run_message m where m.run_id = r.id and m.role = 'user' order by seq limit 1) as first,
         greatest(r.created_at, r.ended_at, (select max(at) from ${s}.run_message m where m.run_id = r.id)) as updated_at,
         e.path as entity_path, e.verification, e.sync
       from ${s}.run r
       left join ${s}.chat c on c.run_id = r.id
       left join ${s}.entity e on e.path = coalesce(c.entity_path, r.target_path)
       where r.automation <> 'setup' and (c.run_id is not null or exists (select 1 from ${s}.run_message m where m.run_id = r.id))
       order by updated_at desc`,
    );
    return {
      chats: rows.map((r) => ({
        workspace,
        runId: r.run_id,
        title: r.title || (r.first ?? '').split('\n')[0]!.slice(0, 80),
        automation: r.automation,
        status: r.status,
        updatedAt: r.updated_at.toISOString(),
        entityPath: r.entity_path,
        verification: r.verification ?? null,
        sync: r.sync ?? null,
      })),
    };
  }

  async createChat(workspace: string, text: string, targetPath?: string): Promise<{ runId: string }> {
    await this.workspaces.get(workspace);
    const runId = await this.runner.create({
      workspace,
      automation: 'chat',
      trigger: 'on_demand',
      prompt: text,
      title: text.split('\n')[0]!.slice(0, 80),
      targetPath: targetPath ?? null,
    });
    void this.orchestrator.tick();
    return { runId };
  }

  /** Starts an automation whose trigger entity allows starting on demand */
  async runAutomation(workspace: string, automation: AutomationName, prompt?: string): Promise<{ runId: string }> {
    const ws = await this.workspaces.get(workspace);
    const trigger = (await this.automations.triggers(ws)).find((t) => t.automation === automation);
    if (!trigger?.on_demand) throw new NotFound(`${automation} does not start on demand in ${workspace}`);
    const runId = await this.runner.create({
      workspace,
      automation,
      trigger: 'on_demand',
      prompt: prompt ?? 'Started on demand by the user: carry out your responsibility for this workspace now.',
    });
    void this.orchestrator.tick();
    return { runId };
  }

  run(id: string): Promise<RunDetail> {
    return this.runner.detail(id);
  }

  async postMessage(id: string, text: string): Promise<void> {
    await this.runner.send(id, text);
  }

  async metrics(workspace: string): Promise<MetricsResponse> {
    return workspaceMetrics(await this.workspaces.get(workspace), this.automations);
  }

  getSettings(): Promise<Settings> {
    return this.settings.get();
  }

  async putSettings(change: PutSettings): Promise<Settings> {
    const before = new Set((await this.settings.enabled()).map((p) => p.name));
    const after = await this.settings.put(change);
    for (const p of after.projects) {
      if (p.enabled && !before.has(p.name)) await this.orchestrator.enable(await this.workspaces.get(p.name));
    }
    void this.orchestrator.tick();
    return after;
  }
}
