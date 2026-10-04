import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AutomationName, EntityDetail, FeedResponse, GraphBuildStatus, MetricsResponse, RunDetail, Settings } from '@momentum/contract';
import { schemaOf } from '@momentum/kb';
import type { Env } from './env.ts';
import { guarded } from './usage.ts';

export interface RunRow {
  id: string;
  automation: AutomationName;
  status: 'queued' | 'running' | 'finished' | 'failed' | 'killed';
  trigger: string;
  title: string;
  target_path: string | null;
  error: string | null;
  model: string | null;
  risk: string | null;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
}

export interface EntityRow {
  path: string;
  type: string;
  title: string;
  card: string;
  verification: 'unverified' | 'verified';
  sync: 'synced' | 'entity_ahead' | 'artifact_ahead' | 'updating';
  contradictions: number;
  frontmatter: Record<string, unknown>;
}

const OPEN = ['queued', 'running'];
/** No request to the back-end waits longer than this */
const REQUEST_MS = 60_000;

/** The back-end of a scenario, as the app and the MCP clients reach it, plus its database for what no route shows */
export class Api {
  constructor(private readonly env: Env) {}

  async call<T>(method: string, path: string, body?: unknown, token: string | null = this.env.token): Promise<T> {
    const r = await fetch(`${this.env.url}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_MS),
    });
    if (!r.ok) throw Object.assign(new Error(`${method} ${path}: ${r.status} ${await r.text()}`), { status: r.status });
    return (r.status === 204 || r.status === 202 ? null : await r.json()) as T;
  }

  feed = () => this.call<FeedResponse>('GET', '/feed');
  entity = (ws: string, path: string) => this.call<EntityDetail>('GET', `/workspaces/${ws}/entities/${path}`);
  settings = () => this.call<Settings>('GET', '/settings');
  putSettings = (s: Partial<Settings>) => this.call<Settings>('PUT', '/settings', s);
  run = (id: string) => this.call<RunDetail>('GET', `/runs/${id}`);
  graphBuild = (ws: string) => this.call<GraphBuildStatus>('GET', `/workspaces/${ws}/graph-build`);
  metrics = (ws: string) => this.call<MetricsResponse>('GET', `/workspaces/${ws}/metrics?range=24h`);
  chat = (ws: string, text: string, targetPath?: string) => this.call<{ runId: string }>('POST', `/workspaces/${ws}/chats`, { text, targetPath });
  approve = (ws: string, path: string) =>
    this.call<null>('POST', `/feed/${encodeURIComponent(path)}/approve`, { workspace: ws, timeSpentMs: 1000 });

  /** A tool of the momentum MCP server, as an MCP client calls it */
  async mcp<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const client = new Client({ name: 'momentum-e2e', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${this.env.url}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${this.env.token}` } },
    });
    await client.connect(transport, { timeout: REQUEST_MS });
    try {
      const r = (await client.callTool({ name, arguments: args }, undefined, { timeout: REQUEST_MS })) as { content: { type: string; text: string }[]; isError?: boolean };
      const text = r.content.map((c) => c.text).join('');
      if (r.isError) throw new Error(`${name}: ${text}`);
      return (text ? JSON.parse(text) : null) as T;
    } finally {
      await client.close();
    }
  }

  runAutomation = (ws: string, automation: AutomationName, prompt?: string) =>
    this.mcp<{ runId: string }>('run_automation', { workspace: ws, automation, ...(prompt ? { prompt } : {}) });

  /** Every run of a workspace, newest first */
  async runs(ws: string, automation?: AutomationName): Promise<RunRow[]> {
    const s = this.env.sql(`${schemaOf(ws)}.run`);
    const rows = await this.env.sql<RunRow[]>`select * from ${s} order by created_at desc`.catch(() => [] as RunRow[]);
    return automation ? rows.filter((r) => r.automation === automation) : rows;
  }

  /** Waits for a run to end, and returns how it ended */
  async runEnded(id: string, timeoutMs = 30 * 60_000): Promise<RunDetail> {
    return until(`run ${id} to end`, async () => {
      const r = await this.run(id);
      return OPEN.includes(r.status) ? null : r;
    }, timeoutMs);
  }

  /** Waits for a run of an automation created after `since` to end */
  async automationRan(ws: string, automation: AutomationName, since: Date, timeoutMs = 30 * 60_000): Promise<RunRow> {
    const started = await until(`a ${automation} run in ${ws}`, async () => (await this.runs(ws, automation)).find((r) => r.created_at >= since) ?? null, timeoutMs);
    await this.runEnded(started.id, timeoutMs);
    return (await this.runs(ws, automation)).find((r) => r.id === started.id)!;
  }

  /** Waits until no run of the workspace is queued or running */
  async idle(ws: string, timeoutMs = 30 * 60_000): Promise<void> {
    await until(`${ws} to go idle`, async () => ((await this.runs(ws)).some((r) => OPEN.includes(r.status)) ? null : true), timeoutMs);
  }

  /** Entities of the index by type, with their states */
  async entities(ws: string, typePrefix = ''): Promise<EntityRow[]> {
    const s = this.env.sql(`${schemaOf(ws)}.entity`);
    const rows = await this.env.sql<EntityRow[]>`select path, type, title, card, verification, sync, contradictions, frontmatter from ${s} order by path`;
    return rows.filter((r) => r.type.startsWith(typePrefix));
  }

  /** Paths of the entities referencing `path` */
  async referencing(ws: string, path: string): Promise<string[]> {
    const s = this.env.sql(`${schemaOf(ws)}.entity_reference`);
    return (await this.env.sql<{ from_path: string }[]>`select from_path from ${s} where to_path = ${path}`).map((r) => r.from_path);
  }
}

/**
 * Polls until `probe` returns a value; stops at once when the usage limit is reached, and when the probe throws an error
 * marked `fatal`: what it waits for can no longer happen
 */
export async function until<T>(what: string, probe: () => Promise<T | null | undefined | false>, timeoutMs = 120_000, everyMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    guarded();
    const v = await probe().catch((e: Error & { fatal?: boolean }) => {
      if (e.fatal) throw e;
      return null;
    });
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
