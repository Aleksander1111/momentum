import { Ajv } from 'ajv';
import formats from 'ajv-formats';
import { until } from '../support/api.ts';
import { PASSWORD } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move, type Entity } from '../support/scripted.ts';

const WS = 'handbook';
const OTHER = 'todo-cli';
const HARNESS = 'momentum';
const kg = (p: string) => `knowledge-graph/${p}.md`;
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const issue = (title: string): Entity => ({
  type: 'Harness/Issue',
  title,
  card: `${title}: two documents disagree.`,
  impact: [4, 4, 4],
  extra: {
    source: 'consistency-check',
    category: 'contradiction',
    severity: 'low',
    options: [
      { label: 'Keep the first', change: 'Make the second say what the first says.' },
      { label: 'Keep the second', change: 'Make the first say what the second says.' },
    ],
    recommended: 0,
  },
});
const ISSUES = ['http-resolve', 'http-wont', 'mcp-resolve', 'mcp-wont'].map((n) => `Harness/Issue/${n}`);

interface Operation {
  responses: Record<string, { content?: { 'application/json'?: { schema: object } } }>;
}
interface OpenApi {
  paths: Record<string, Record<string, Operation>>;
  components: object;
}

// Every route and tool a client has, called the way a client calls it, and held to the document the back-end serves
scenario('api-contract', { enabled: [WS, OTHER] }, async ({ env, api, model, step }) => {
  // Chats that resolve an issue retire it, as the chat definition says
  model.on('resolves the issue', (t) => t.automation === 'chat' && t.kind === 'prompt' && !!t.target?.startsWith('Harness/Issue/'), (t) => [
    move.remove(t, kg(t.target!)),
    move.say('Retired.'),
  ]);

  const triggers = async (ws: string) => (await api.feed()).items.filter((i) => i.workspace === ws && i.type === 'Harness/Trigger').map((i) => i.path);
  const inFeed = async (ws: string, path: string) => (await api.feed()).items.some((i) => i.workspace === ws && i.path === path);

  await step(0, async () => {
    env.commit(WS, Object.fromEntries(ISSUES.map((p) => [kg(p), entityText(issue(p.split('/').pop()!))])), 'File four issues');
    await until('the issues in the feed', async () => (await Promise.all(ISSUES.map((p) => inFeed(WS, p)))).every(Boolean));

    const doc = (await (await fetch(`${env.url}/openapi.json`)).json()) as OpenApi;
    const ajv = new Ajv({ strict: false, allErrors: true });
    // CommonJS under ESM: the function is the default export's default
    const addFormats = ((formats as unknown as { default?: unknown }).default ?? formats) as (a: Ajv) => Ajv;
    addFormats(ajv);
    // The document's shared schemas, which the responses refer to, under $defs: where the validator looks for schemas a
    // reference points into
    // OpenAPI 3.0 says an exclusive bound with a flag beside the bound; JSON Schema, which the validator reads, with the
    // bound itself
    const bounds = (x: unknown): unknown => {
      if (Array.isArray(x)) return x.map(bounds);
      if (!x || typeof x !== 'object') return x;
      const o = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, bounds(v)])) as Record<string, unknown>;
      for (const [flag, bound] of [['exclusiveMinimum', 'minimum'], ['exclusiveMaximum', 'maximum']] as const) {
        if (typeof o[flag] !== 'boolean') continue;
        if (o[flag]) o[flag] = o[bound];
        else delete o[flag];
        if (o[flag] !== undefined) delete o[bound];
      }
      return o;
    };
    const shared = (schema: object) => bounds(JSON.parse(JSON.stringify(schema).replaceAll('"#/components/schemas/', '"api.json#/$defs/'))) as object;
    ajv.addSchema({ $defs: shared((doc.components as { schemas?: object }).schemas ?? {}) }, 'api.json');
    /** Every operation of the document, as METHOD template */
    const operations = Object.entries(doc.paths).flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`));
    const called = new Set<string>();
    const failures: string[] = [];

    /** Calls an operation and holds its answer to the status and schema the document gives it */
    const call = async <T = unknown>(method: string, template: string, url: string, body?: unknown, token: string | null = env.token): Promise<{ status: number; json: T }> => {
      const r = await fetch(`${env.url}${url}`, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      const json = (text ? JSON.parse(text) : null) as T;
      const op = doc.paths[template]?.[method.toLowerCase()];
      const label = `${method} ${template}`;
      called.add(label);
      if (!op) {
        failures.push(`${label}: not in the document`);
        return { status: r.status, json };
      }
      const declared = op.responses[String(r.status)];
      if (!declared) failures.push(`${label} answered ${r.status}, which the document does not declare (${Object.keys(op.responses).join(', ')}): ${text.slice(0, 200)}`);
      const schema = declared?.content?.['application/json']?.schema;
      if (schema) {
        const validate = ajv.compile(shared(schema));
        if (!validate(json)) failures.push(`${label} ${r.status}: ${ajv.errorsText(validate.errors)} in ${text.slice(0, 200)}`);
      } else if (text && r.status !== 204) failures.push(`${label} ${r.status}: a body the document does not describe`);
      return { status: r.status, json };
    };
    const ok = async <T = unknown>(method: string, template: string, url: string, body?: unknown, token?: string | null) => {
      const r = await call<T>(method, template, url, body, token);
      expect(r.status, `${method} ${url}`).toBeLessThan(300);
      return r.json;
    };

    // Signing in and out, and what is refused without a session
    expect((await call('POST', '/session', '/session', { password: 'wrong' }, null)).status).toBe(401);
    const { token } = await ok<{ token: string }>('POST', '/session', '/session', { password: PASSWORD }, null);
    await ok('DELETE', '/session', '/session', undefined, token);
    expect((await call('GET', '/feed', '/feed', undefined, token)).status).toBe(401);
    expect((await call('GET', '/workspaces', '/workspaces', undefined, null)).status).toBe(401);

    // Reading
    await ok('GET', '/workspaces', '/workspaces');
    await ok('GET', '/feed', '/feed');
    await ok('GET', '/settings', '/settings');
    await ok('GET', '/timeline', '/timeline?limit=20');
    await ok('GET', '/workspaces/{ws}/entities/{*}', `/workspaces/${WS}/entities/Governance/Policy/leave-policy`);
    expect((await call('GET', '/workspaces/{ws}/entities/{*}', `/workspaces/${WS}/entities/Nowhere/none`)).status).toBe(404);
    await ok('GET', '/workspaces/{ws}/artifact/{*}', `/workspaces/${WS}/artifact/docs/leave-policy.md`);
    await ok('GET', '/workspaces/{ws}/types', `/workspaces/${WS}/types`);
    await ok('GET', '/workspaces/{ws}/search', `/workspaces/${WS}/search?q=holiday`);
    await ok('POST', '/workspaces/{ws}/ask', `/workspaces/${WS}/ask`, { q: 'How many days of holiday do I get?' });
    await ok('GET', '/workspaces/{ws}/metrics', `/workspaces/${WS}/metrics?range=24h`);
    await ok('GET', '/workspaces/{ws}/graph-build', `/workspaces/${WS}/graph-build`);

    // The feed's reactions
    const [approveMe, sendMeBack] = await triggers(WS);
    await ok('POST', '/feed/{path}/approve', `/feed/${encodeURIComponent(approveMe!)}/approve`, { workspace: WS, timeSpentMs: 800 });
    await ok('POST', '/feed/{path}/send-back', `/feed/${encodeURIComponent(sendMeBack!)}/send-back`, { workspace: WS, comment: 'Only on demand.', timeSpentMs: 800 });
    await ok('POST', '/feed/{path}/resolve', `/feed/${encodeURIComponent(ISSUES[0]!)}/resolve`, { workspace: WS, option: 0, timeSpentMs: 800 });
    await ok('POST', '/feed/{path}/wont-resolve', `/feed/${encodeURIComponent(ISSUES[1]!)}/wont-resolve`, { workspace: WS, comment: 'Not worth it.', timeSpentMs: 800 });

    // Chats and runs
    const { runId } = await ok<{ runId: string }>('POST', '/workspaces/{ws}/chats', `/workspaces/${WS}/chats`, { text: 'Which policies are there?' });
    await api.runEnded(runId, 5 * 60_000);
    await ok('GET', '/workspaces/{ws}/chats', `/workspaces/${WS}/chats`);
    await ok('GET', '/runs/{id}', `/runs/${runId}`);
    await ok('POST', '/runs/{id}/messages', `/runs/${runId}/messages`, { text: 'And which guides?' });
    await api.answered(runId, 2, 5 * 60_000);
    const { runId: longer } = await ok<{ runId: string }>('POST', '/workspaces/{ws}/chats', `/workspaces/${WS}/chats`, { text: 'Read every document.' });
    await ok('POST', '/runs/{id}/kill', `/runs/${longer}/kill`);
    expect((await call('GET', '/runs/{id}', '/runs/nonexistent')).status).toBe(404);

    // Settings, logos, the graph build and a reset
    await ok('PUT', '/settings', '/settings', { feedSize: 30 });
    await ok('PUT', '/workspaces/{ws}/logo', `/workspaces/${WS}/logo`, { logo: LOGO });
    expect((await call('PUT', '/workspaces/{ws}/logo', `/workspaces/${WS}/logo`, { logo: 'data:text/html;base64,PGgxPg==' })).status).toBe(400);
    await ok('DELETE', '/workspaces/{ws}/logo', `/workspaces/${WS}/logo`);
    await ok('PUT', '/workspaces/{ws}/graph-build', `/workspaces/${OTHER}/graph-build`, { building: false });
    expect((await call('POST', '/workspaces/{ws}/reset', `/workspaces/${HARNESS}/reset`)).status).toBe(409);
    await ok('POST', '/workspaces/{ws}/reset', `/workspaces/${OTHER}/reset`);

    expect(failures).toEqual([]);
    // Every route of the document was called
    expect(operations.filter((o) => !called.has(o))).toEqual([]);
  });

  await step(1, async () => {
    await api.idle(WS, 5 * 60_000);
    const [approveMe, sendMeBack] = await triggers(WS);
    const commits = Number(env.git(WS, 'rev-list', '--count', 'main'));
    await api.mcp('approve', { workspace: WS, path: approveMe });
    expect((await api.entity(WS, approveMe!)).verification).toBe('verified');
    expect(Number(env.git(WS, 'rev-list', '--count', 'main'))).toBe(commits + 1);

    const sent = await api.mcp<{ runId: string }>('send_back', { workspace: WS, path: sendMeBack, comment: 'Run it on demand only.' });
    const run = await api.run(sent.runId);
    expect(run.targetPath).toBe(sendMeBack);
    expect(run.messages[0]!.text).toContain('Run it on demand only.');
    await api.runEnded(sent.runId, 5 * 60_000);

    const resolved = await api.mcp<{ runId: string }>('resolve_issue', { workspace: WS, path: ISSUES[2], option: 1 });
    expect((await api.run(resolved.runId)).messages[0]!.text).toBe('Keep the second: Make the first say what the second says.');
    expect((await api.runEnded(resolved.runId, 5 * 60_000)).status).toBe('finished');
    await until('the resolved issue gone', async () => !(await inFeed(WS, ISSUES[2]!)));
    expect(env.show(WS, kg(ISSUES[2]!))).toBeNull();

    await api.mcp('wont_resolve_issue', { workspace: WS, path: ISSUES[3], reason: 'They describe different years.' });
    expect((await api.entity(WS, ISSUES[3]!)).verification).toBe('verified');
    expect(env.show(WS, kg(ISSUES[3]!))).toContain('wont_resolve: They describe different years.');
  });

  await step(2, async () => {
    // The build of the project the reset left building is stopped through MCP, and started again
    const stopped = await api.mcp<{ state: string }>('set_graph_build', { workspace: OTHER, building: false });
    expect(stopped.state).toBe('stopped');
    await until('no build run open', async () => !(await api.runs(OTHER, 'graph-build')).some((r) => r.status === 'queued' || r.status === 'running'), 60_000);
    const started = await api.mcp<{ state: string }>('set_graph_build', { workspace: OTHER, building: true });
    expect(started.state).toBe('building');
    expect((await api.mcp<{ state: string }>('graph_build', { workspace: OTHER })).state).toBe('building');
    await api.mcp('set_graph_build', { workspace: OTHER, building: false });

    // A reset through MCP: nothing of the knowledge graph left but the default triggers, and the build afresh
    env.commit(OTHER, { [kg('Product/Feature/due-dates')]: entityText({ type: 'Product/Feature', origin: 'user', title: 'Due dates', card: 'To-dos with dates.' }) }, 'Describe due dates');
    await until('the feature indexed', async () => (await api.entities(OTHER)).some((e) => e.path === 'Product/Feature/due-dates'));
    const reset = await api.mcp<{ state: string }>('reset_project', { workspace: OTHER });
    expect(reset.state).toBe('building');
    expect(env.files(OTHER).every((f) => f.startsWith('knowledge-graph/Harness/Trigger/'))).toBe(true);
    expect((await api.entities(OTHER)).every((e) => e.type === 'Harness/Trigger')).toBe(true);
    await expect(api.mcp('reset_project', { workspace: HARNESS })).rejects.toThrow();
    expect(env.files(HARNESS).some((f) => f.startsWith('knowledge-graph/Harness/Automation/'))).toBe(true);
  });
});
