import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const PROJECTS = ['handbook', 'todo-cli'] as const;
const FEED = 24;

const issue = (n: number, ws: string) => ({
  type: 'Harness/Issue',
  title: `Check ${n} in ${ws}`,
  card: `Finding ${n} of the nightly check in ${ws}.`,
  impact: [n % 4, 2, 1] as [number, number, number],
  references: [],
  extra: { source: 'consistency-check', category: 'gap', severity: 'low', options: [{ label: 'Fix it', change: `Fix finding ${n}.` }, { label: 'Leave it', change: 'Nothing to do.' }] },
});

// Overnight the consistency check runs in both projects; the graph build of todo-cli goes on while the feed has room
scenario('morning-triage', { enabled: [...PROJECTS], triggers: ['consistency-check'], settings: { feedSize: FEED } }, async ({ env, api, app, model, step }) => {
  model.on('nightly checks', { automation: 'consistency-check', kind: 'prompt' }, (t) => {
    const ws = t.checkout.includes('handbook') ? 'handbook' : 'todo-cli';
    return [...[1, 2, 3, 4].map((n) => move.entity(t, `Harness/Issue/check-${n}`, issue(n, ws))), move.say('Four findings.')];
  });
  model.on('graph build', { automation: 'graph-build', kind: 'prompt' }, (t) => {
    const room = Number(/room for (\d+) more/.exec(t.input)?.[1] ?? 0);
    const n = model.log.filter((l) => l.automation === 'graph-build' && l.step === 0 && l.kind === 'prompt').length;
    return [
      ...Array.from({ length: Math.min(room, 2) }, (_, i) =>
        move.entity(t, `Knowledge/Faq/question-${n}-${i}`, { type: 'Knowledge/Faq', title: `Question ${n}.${i}`, card: `An answer mapped by build run ${n}.` }),
      ),
      move.graphBuild({ complete: n >= 4, progress: `Run ${n} done`, coverage: Math.min(1, n / 4) }),
      move.say('Mapped.'),
    ];
  });
  model.on('a send back changes the card', (t) => t.automation === 'chat' && t.kind === 'prompt' && !!t.target?.startsWith('Knowledge/Faq/'), (t) => [
    move.write(t, `knowledge-graph/${t.target}.md`, entityText({ type: 'Knowledge/Faq', title: 'Rewritten question', card: 'A clearer answer.' })),
    move.say('Rewritten.'),
  ]);

  await step(0, async () => {
    await api.call('PUT', '/workspaces/todo-cli/graph-build', { building: true });
    await until('the feed full', async () => (await api.feed()).items.length >= FEED, 3 * 60_000);
    await new Promise((r) => setTimeout(r, 10_000));
    const feed = await api.feed();
    expect(feed.items.length).toBe(FEED);
    expect(new Set(feed.items.map((i) => i.workspace))).toEqual(new Set(PROJECTS));
    // Paused: no build run waits or runs while the feed is full
    expect((await api.runs('todo-cli', 'graph-build')).filter((r) => r.status === 'queued' || r.status === 'running')).toEqual([]);
    const ranks = feed.items.map((i) => i.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  await step(1, async () => {
    const before = (await api.metrics('handbook')).attention;
    const items = (await api.feed()).items;
    const issues = items.filter((i) => i.type === 'Harness/Issue');
    // A quick pass through the top of the feed, the way a morning goes
    await app.resolve(issues[0]!.workspace, issues[0]!.path, 0);
    await app.wontResolve(issues[1]!.workspace, issues[1]!.path, 'Not worth it this quarter.');
    const triggers = items.filter((i) => i.type === 'Harness/Trigger').slice(0, 3);
    for (const t of triggers) await app.approve(t.workspace, t.path);
    const after = (await api.metrics('handbook')).attention;
    expect(after.timePerItemSeconds.value).not.toBeNull();
    expect(after.approved.value! + after.sentBack.value! + after.rejected.value!).toBeGreaterThan(
      (before.approved.value ?? 0) + (before.sentBack.value ?? 0) + (before.rejected.value ?? 0),
    );
  });

  await step(2, async () => {
    // The phone shows a card; a run changes it before the swipe arrives
    const [faq] = await until('a mapped question in the feed', async () => {
      const rows = (await api.feed()).items.filter((i) => i.type === 'Knowledge/Faq');
      return rows.length ? rows : null;
    }, 3 * 60_000);
    const seen = faq!.version;
    expect(seen).toBeTruthy();
    const chat = await api.chat(faq!.workspace, 'Rewrite this question more clearly.', faq!.path);
    expect((await api.runEnded(chat.runId, 3 * 60_000)).status).toBe('finished');
    await expect(api.call('POST', `/feed/${encodeURIComponent(faq!.path)}/approve`, { workspace: faq!.workspace, timeSpentMs: 900, version: seen })).rejects.toMatchObject({ status: 409 });
    expect((await api.entity(faq!.workspace, faq!.path)).verification).toBe('unverified');
    // The card the user sees now is the new one; approving it works
    const now = await until('the new version in the feed', async () => (await api.feed()).items.find((i) => i.path === faq!.path && i.version !== seen));
    await api.call('POST', `/feed/${encodeURIComponent(faq!.path)}/approve`, { workspace: faq!.workspace, timeSpentMs: 900, version: now.version });
    expect((await api.entity(faq!.workspace, faq!.path)).verification).toBe('verified');
  });

  await step(3, async () => {
    // With room made, the paused build goes on until it is complete
    for (const item of (await api.feed()).items.filter((i) => i.type === 'Knowledge/Faq' || i.type === 'Harness/Trigger').slice(0, 8)) await api.approve(item.workspace, item.path);
    await until('the build complete', async () => {
      const room = FEED - (await api.feed()).items.length;
      if (room < 2) for (const item of (await api.feed()).items.filter((i) => i.type === 'Knowledge/Faq')) await api.approve(item.workspace, item.path);
      return (await api.graphBuild('todo-cli')).state === 'complete';
    }, 4 * 60_000, 3000);
    expect((await api.feed()).items.length).toBeLessThanOrEqual(FEED);
    expect(env.files('todo-cli').filter((f) => f.includes('Knowledge/Faq')).length).toBeGreaterThan(0);
  });
});
