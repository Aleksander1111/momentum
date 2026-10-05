import type { TimelineResponse } from '@momentum/contract';
import { WebSocket } from 'ws';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'bookshelf-api';
const ENTITY = 'Architecture/Api/books-api';

scenario('access', { enabled: [WS] }, async ({ env, api, app, step }) => {
  await step(0, async () => {
    await expect(api.call('POST', '/session', { password: 'wrong' }, null)).rejects.toMatchObject({ status: 401 });
    const routes = [
      '/workspaces',
      '/feed',
      `/workspaces/${WS}/types`,
      `/workspaces/${WS}/search?q=books`,
      `/workspaces/${WS}/chats`,
      `/workspaces/${WS}/entities/${ENTITY}`,
      `/workspaces/${WS}/artifact/src/server.js`,
      `/workspaces/${WS}/metrics`,
      `/workspaces/${WS}/graph-build`,
      '/timeline',
      '/settings',
    ];
    for (const r of routes) {
      await expect(api.call('GET', r, undefined, null), `${r} without a session`).rejects.toMatchObject({ status: 401 });
      await expect(api.call('GET', r), `${r} with a session`).resolves.toBeTruthy();
    }
    expect((await api.call<{ name: string; enabled: boolean }[]>('GET', '/workspaces')).find((w) => w.name === WS)?.enabled).toBe(true);
    expect((await api.entity(WS, ENTITY)).artifacts.map((a) => a.path)).toContain('src/server.js');
    const search = await api.call<{ results: { path: string }[] }>('GET', `/workspaces/${WS}/search?q=routes`);
    expect(search.results.map((r) => r.path)).toContain(ENTITY);
    const settings = await api.putSettings({ feedSize: 25 });
    expect(settings.feedSize).toBe(25);
    await expect(api.call('GET', `/workspaces/${WS}/entities/Nowhere/none`)).rejects.toMatchObject({ status: 404 });
  });

  await step(1, async () => {
    expect((await api.mcp<{ name: string }[]>('workspaces')).map((w) => w.name)).toContain(WS);
    expect((await api.mcp<{ items: unknown[] }>('feed')).items.length).toBeGreaterThan(0);
    expect((await api.mcp<{ path: string }>('entity', { workspace: WS, path: ENTITY })).path).toBe(ENTITY);
    expect((await api.mcp<{ types: unknown[] }>('types', { workspace: WS })).types.length).toBeGreaterThan(0);
    expect((await api.mcp<{ results: unknown[] }>('search', { workspace: WS, query: 'books' })).results.length).toBeGreaterThan(0);
    expect((await api.mcp<{ state: string }>('graph_build', { workspace: WS })).state).toBe('stopped');
    expect((await api.mcp<{ feedSize: number }>('settings')).feedSize).toBe(25);
    expect((await api.mcp<{ feedSize: number }>('update_settings', { feedSize: 40 })).feedSize).toBe(40);
    expect((await api.mcp<{ workspace: string }>('metrics', { workspace: WS })).workspace).toBe(WS);
    // No trigger is approved yet, so nothing starts on demand
    await expect(api.runAutomation(WS, 'exploration')).rejects.toThrow(/does not start on demand/);

    const { runId } = await api.mcp<{ runId: string }>('chat', { workspace: WS, text: 'Which routes does the API have?' });
    expect((await api.mcp<{ id: string }>('run', { id: runId })).id).toBe(runId);
    await api.mcp('message', { id: runId, text: 'Answer in one line.' });
    expect((await api.mcp<{ chats: { runId: string }[] }>('chats', { workspace: WS })).chats.map((c) => c.runId)).toContain(runId);
    await api.mcp('kill_run', { id: runId });
    expect((await api.runEnded(runId)).status).toBe('killed');
  });

  await step(2, async () => {
    const refused = (path: string) =>
      new Promise<number>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${env.port}${path}?client=intruder`);
        ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
        ws.on('open', () => resolve(101));
        ws.on('error', () => resolve(0));
      });
    expect(await refused('/voice')).toBe(401);
    expect(await refused('/voice/audio')).toBe(401);
  });

  await step(3, async () => {
    for (const tab of ['Explorer', 'Chat', 'Metrics', 'Settings', 'Feed'] as const) await app.tab(tab);
    await app.tab('Metrics');
    await expect(app.text('Rolling 5 hours')).toBeVisible();
    await expect(app.frame().getByText('$')).toHaveCount(0);
    await app.tab('Settings');
    for (const mode of ['One model', 'Per automation', 'By risk']) await expect(app.frame().getByRole('radio', { name: mode })).toBeVisible();

    await app.entity(WS, ENTITY);
    await expect(app.text('Books API', false)).toBeVisible();
    await expect(app.text(/Unverified|Verified/, false)).toBeVisible();

    // The default triggers wait in the feed: approve one, send another back
    const [first, second] = (await api.feed()).items.filter((i) => i.type === 'Harness/Trigger');
    await app.approve(WS, first!.path);
    expect((await api.entity(WS, first!.path)).verification).toBe('verified');
    const sentBack = await app.sendBack(WS, second!.path, 'Run it only on demand.');
    expect((await api.run(sentBack)).targetPath).toBe(second!.path);

    const chat = await app.chat(WS, 'Summarize the API in one sentence.');
    expect((await api.run(chat)).automation).toBe('chat');
  });

  await step(4, async () => {
    const { events } = await api.call<TimelineResponse>('GET', '/timeline?limit=500');
    const kinds = events.map((e) => e.kind);
    for (const kind of ['sign_in_failed', 'signed_in', 'settings_changed', 'chat_started', 'message_sent', 'run_killed', 'approved', 'sent_back'] as const) {
      expect(kinds, kind).toContain(kind);
    }
    expect(events.map((e) => e.at)).toEqual(events.map((e) => e.at).sort().reverse());
    // One event per run: the chat stopped through MCP is one event, and says who stopped it
    const stopped = events.filter((e) => e.kind === 'run_killed');
    expect(new Set(stopped.map((e) => e.runId)).size).toBe(stopped.length);
    expect(stopped.some((e) => e.automation === 'chat' && e.title.startsWith('Stopped by you'))).toBe(true);
    const mine = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=user`);
    expect(mine.events.length).toBeGreaterThan(0);
    expect(mine.events.every((e) => e.workspace === WS && e.actor === 'user')).toBe(true);
    const page = await api.mcp<TimelineResponse>('timeline', { limit: 3 });
    expect(page.events).toHaveLength(3);
    expect(page.next).toBe(page.events[2]!.id);

    // In the app, and beside it in the observer, where the next action shows up without a reload
    const approved = events.find((e) => e.kind === 'approved')!;
    // The row's check already says it was approved: the line names only what was
    const what = approved.title.replace(/^Approved\s+“?(.*?)”?$/, '$1');
    await app.tab('Timeline');
    await expect(app.text(what, false)).toBeVisible();
    await expect(app.timeline().getByText(what).first()).toBeVisible({ timeout: 15_000 });
    await api.putSettings({ feedSize: 30 });
    await until('the settings change in the timeline', async () => (await api.call<TimelineResponse>('GET', '/timeline?limit=1')).events[0]?.kind === 'settings_changed');
    await expect(app.timeline().getByText('Changed the feed size').first()).toBeVisible({ timeout: 15_000 });
  });
});
