import { Platform } from 'react-native';
import { router } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import {
  AskResponse,
  ChatsResponse,
  EntityDetail,
  FeedResponse,
  GraphBuildStatus,
  MetricsRange,
  MetricsResponse,
  RunDetail,
  SearchResult,
  SessionResponse,
  Settings,
  TimelineResponse,
  TypesResponse,
  Workspace,
  type TimelineActor,
  type ApproveRequest,
  type CreateChatRequest,
  type PostRunMessage,
  type PutGraphBuild,
  type PutSettings,
  type ResolveRequest,
  type SendBackRequest,
  type WontResolveRequest,
  type SessionRequest,
} from '@momentum/contract';
import { clearToken, getToken, setToken } from './token';

/** Web is served same-origin by the back-end; native reaches it over the mesh. */
const BASE = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_URL ?? '');

export class UnauthorizedError extends Error {}
export class NetworkError extends Error {}
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Reachability: a failed fetch marks the API offline so queries pause and reactions queue;
// a probe restores it as soon as the API answers anything.
let probe: ReturnType<typeof setInterval> | null = null;

function markUnreachable() {
  onlineManager.setOnline(false);
  if (probe) return;
  probe = setInterval(() => {
    fetch(`${BASE}/workspaces`, { credentials: 'include' })
      .then(() => markReachable())
      .catch(() => undefined);
  }, 5000);
}

function markReachable() {
  if (probe) {
    clearInterval(probe);
    probe = null;
  }
  if (!onlineManager.isOnline()) onlineManager.setOnline(true);
}

let redirecting = false;

async function onUnauthorized() {
  await clearToken();
  if (redirecting) return;
  redirecting = true;
  router.replace('/session');
}

async function request(method: string, path: string, body?: unknown, redirectOn401 = true): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch (e) {
    markUnreachable();
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
  markReachable();
  if (res.status === 401) {
    if (redirectOn401) void onUnauthorized();
    throw new UnauthorizedError('401');
  }
  if (!res.ok) throw new HttpError(res.status, refusal(await res.text().catch(() => '')));
  return res;
}

/** What the back-end says when it refuses: the `error` of its answer, which is written for the user */
function refusal(body: string): string {
  try {
    const { error } = JSON.parse(body) as { error?: unknown };
    if (typeof error === 'string' && error) return error;
  } catch {
    // not the API's own answer
  }
  return body || 'The harness refused that.';
}

type Schema<T> = { parse: (data: unknown) => T };

async function get<T>(path: string, schema: Schema<T>): Promise<T> {
  const res = await request('GET', path);
  return schema.parse(await res.json());
}

const seg = (s: string) => encodeURIComponent(s);
const segs = (p: string) => p.split('/').map(encodeURIComponent).join('/');

const RunIdResponse = { parse: (d: unknown) => d as { runId: string } };
const ArtifactResponse = { parse: (d: unknown) => d as { path: string; text: string } };
const SearchResponse = {
  parse: (d: unknown) => ({ results: SearchResult.array().parse((d as { results: unknown }).results) }),
};

export const api = {
  async session(req: SessionRequest): Promise<SessionResponse> {
    const res = await request('POST', '/session', req, false);
    const out = SessionResponse.parse(await res.json());
    if (Platform.OS !== 'web') await setToken(out.token);
    redirecting = false;
    return out;
  },
  workspaces: () => get('/workspaces', Workspace.array()),
  feed: () => get('/feed', FeedResponse),
  async approve(path: string, req: ApproveRequest): Promise<void> {
    await request('POST', `/feed/${seg(path)}/approve`, req);
  },
  async sendBack(path: string, req: SendBackRequest): Promise<{ runId: string }> {
    const res = await request('POST', `/feed/${seg(path)}/send-back`, req);
    return RunIdResponse.parse(await res.json());
  },
  async resolve(path: string, req: ResolveRequest): Promise<{ runId: string }> {
    const res = await request('POST', `/feed/${seg(path)}/resolve`, req);
    return RunIdResponse.parse(await res.json());
  },
  async wontResolve(path: string, req: WontResolveRequest): Promise<void> {
    await request('POST', `/feed/${seg(path)}/wont-resolve`, req);
  },
  entity: (ws: string, path: string) => get(`/workspaces/${seg(ws)}/entities/${segs(path)}`, EntityDetail),
  types: (ws: string) => get(`/workspaces/${seg(ws)}/types`, TypesResponse),
  artifact: (ws: string, path: string) => get(`/workspaces/${seg(ws)}/artifact/${segs(path)}`, ArtifactResponse),
  search: (ws: string, q: string) => get(`/workspaces/${seg(ws)}/search?q=${encodeURIComponent(q)}`, SearchResponse),
  async ask(ws: string, q: string): Promise<AskResponse> {
    const res = await request('POST', `/workspaces/${seg(ws)}/ask`, { q });
    return AskResponse.parse(await res.json());
  },
  chats: (ws: string) => get(`/workspaces/${seg(ws)}/chats`, ChatsResponse),
  async createChat(ws: string, req: CreateChatRequest): Promise<{ runId: string }> {
    const res = await request('POST', `/workspaces/${seg(ws)}/chats`, req);
    return RunIdResponse.parse(await res.json());
  },
  run: (id: string) => get(`/runs/${seg(id)}`, RunDetail),
  async postMessage(id: string, req: PostRunMessage): Promise<void> {
    await request('POST', `/runs/${seg(id)}/messages`, req);
  },
  async killRun(id: string): Promise<void> {
    await request('POST', `/runs/${seg(id)}/kill`);
  },
  metrics: (ws: string, range: MetricsRange) => get(`/workspaces/${seg(ws)}/metrics?range=${range}`, MetricsResponse),
  graphBuild: (ws: string) => get(`/workspaces/${seg(ws)}/graph-build`, GraphBuildStatus),
  async putGraphBuild(ws: string, req: PutGraphBuild): Promise<GraphBuildStatus> {
    const res = await request('PUT', `/workspaces/${seg(ws)}/graph-build`, req);
    return GraphBuildStatus.parse(await res.json());
  },
  async resetProject(ws: string): Promise<GraphBuildStatus> {
    const res = await request('POST', `/workspaces/${seg(ws)}/reset`);
    return GraphBuildStatus.parse(await res.json());
  },
  async putProjectLogo(ws: string, logo: string): Promise<Workspace> {
    const res = await request('PUT', `/workspaces/${seg(ws)}/logo`, { logo });
    return Workspace.parse(await res.json());
  },
  async deleteProjectLogo(ws: string): Promise<Workspace> {
    const res = await request('DELETE', `/workspaces/${seg(ws)}/logo`);
    return Workspace.parse(await res.json());
  },
  timeline(q: { workspace?: string; actor?: TimelineActor; before?: number; limit?: number }) {
    const params = Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
    return get(`/timeline${params.length ? `?${params.join('&')}` : ''}`, TimelineResponse);
  },
  settings: () => get('/settings', Settings),
  async putSettings(req: PutSettings): Promise<Settings> {
    const res = await request('PUT', '/settings', req);
    return Settings.parse(await res.json());
  },
};
