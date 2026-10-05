import type { TimelineEvent, TimelineResponse, Workspace } from '@momentum/contract';
import { WebSocket } from 'ws';
import { until } from '../support/api.ts';
import { PASSWORD } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'handbook';
// A 1×1 PNG
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

scenario('devices', { enabled: [WS] }, async ({ env, api, app, step }) => {
  const signIn = async (password: string) => {
    const r = await fetch(`${env.url}/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    return { status: r.status, token: r.ok ? ((await r.json()) as { token: string }).token : null };
  };
  const status = (token: string, path = '/feed') => fetch(`${env.url}${path}`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.status);
  const socket = (token: string) =>
    new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${env.port}/voice?client=laptop`, { headers: { authorization: `Bearer ${token}` } });
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      ws.on('open', () => {
        ws.close();
        resolve(101);
      });
      ws.on('error', () => resolve(0));
    });

  const devices = await step(0, async () => {
    expect((await signIn('not the password')).status).toBe(401);
    const laptop = await signIn(PASSWORD);
    const tablet = await signIn(PASSWORD);
    expect(laptop.status).toBe(200);
    for (const t of [laptop.token!, tablet.token!, env.token]) expect(await status(t)).toBe(200);
    const { events } = await api.call<TimelineResponse>('GET', '/timeline?actor=user&limit=20');
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(['sign_in_failed', 'signed_in']));
    return { laptop: laptop.token!, tablet: tablet.token! };
  });

  await step(1, async () => {
    expect(await socket(devices.tablet)).toBe(101);
    const r = await fetch(`${env.url}/session`, { method: 'DELETE', headers: { authorization: `Bearer ${devices.tablet}` } });
    expect(r.status).toBe(204);
    expect(await status(devices.tablet)).toBe(401);
    expect(await status(devices.tablet, '/mcp')).toBe(401);
    expect(await socket(devices.tablet)).toBe(401);
    // The other devices stay signed in, and the app goes on
    expect(await status(devices.laptop)).toBe(200);
    await app.tab('Feed');
    await expect(app.frame().getByPlaceholder('Password')).toHaveCount(0);
  });

  await step(2, async () => {
    const [first, second] = (await api.feed()).items;
    await app.tab('Feed');
    await expect(app.text(first!.title)).toBeVisible({ timeout: 30_000 });
    // The back-end goes away; the phone notices on its next request
    env.stop();
    await new Promise((r) => setTimeout(r, 17_000));
    await app.swipeTop(first!.title, true);
    // The approved card left the phone's stack at once; the next is on top
    await expect(app.text(second!.title)).toBeVisible({ timeout: 10_000 });
    await env.start();
    // The user approves the same card on the laptop before the phone is back
    await api.approve(WS, first!.path);
    await until('the queued swipe to land', async () => !(await api.feed()).items.some((i) => i.path === first!.path), 60_000);
    await new Promise((r) => setTimeout(r, 12_000));
    const [n] = await env.sql<{ n: number }[]>`select count(*)::int as n from ${env.sql('ws_handbook.attention_metric')} where entity_path = ${first!.path}`;
    expect(n!.n).toBe(1);
    expect(env.git(WS, 'log', '--format=%s', 'main').split('\n').filter((s) => s === `Approve ${first!.title}`)).toHaveLength(1);
    await app.open();
  });

  await step(3, async () => {
    const put = await api.call<Workspace>('PUT', `/workspaces/${WS}/logo`, { logo: LOGO });
    expect(put.logo).toBe(LOGO);
    expect((await api.call<Workspace[]>('GET', '/workspaces')).find((w) => w.name === WS)?.logo).toBe(LOGO);
    await expect(api.call('PUT', `/workspaces/${WS}/logo`, { logo: 'data:text/html;base64,PGgxPmhpPC9oMT4=' })).rejects.toMatchObject({ status: 400 });
    await expect(api.call('PUT', '/workspaces/nowhere/logo', { logo: LOGO })).rejects.toMatchObject({ status: 404 });
    await app.tab('Settings');
    await expect(app.text('Uploaded')).toBeVisible();
    expect((await api.call<Workspace>('DELETE', `/workspaces/${WS}/logo`)).logo).toBeNull();
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=user`);
    expect(events.filter((e) => e.kind === 'logo_changed').map((e) => e.title)).toEqual([`Removed the logo of ${WS}`, `Changed the logo of ${WS}`]);
  });

  await step(4, async () => {
    const all: TimelineEvent[] = [];
    let before: number | undefined;
    for (;;) {
      const page = await api.call<TimelineResponse>('GET', `/timeline?limit=3${before ? `&before=${before}` : ''}`);
      all.push(...page.events);
      if (!page.next) break;
      before = page.next;
    }
    const whole = await api.call<TimelineResponse>('GET', '/timeline?limit=500');
    expect(all.map((e) => e.id)).toEqual(whole.events.map((e) => e.id));
    const mine = await api.call<TimelineResponse>(`GET`, `/timeline?workspace=${WS}&actor=user&limit=500`);
    expect(mine.events.length).toBeGreaterThan(0);
    expect(mine.events.every((e) => e.workspace === WS && e.actor === 'user')).toBe(true);
    await app.tab('Timeline');
    await expect(app.text(whole.events[0]!.title, false)).toBeVisible({ timeout: 15_000 });
  });
});
