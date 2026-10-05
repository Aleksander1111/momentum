import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const PROJECTS = ['handbook', 'todo-cli'] as const;
/** Two more items than the night's checks leave: room for the build to fill the feed */
let FEED = 0;
/** More of todo-cli to map than one build run gets through */
const DOCS = {
  'docs/usage.md': '# Usage\n\n- `todo add <text>` adds a to-do\n- `todo list` lists them, open ones first\n- `todo done <id>` completes one\n- `todo remove <id>` removes one\n',
  'docs/storage.md': '# Storage\n\nTo-dos live in one JSON file, `~/.todo.json` unless `TODO_FILE` names another. Each to-do has an id, its text, and whether it is done. The file is rewritten whole on every change.\n',
  'CONTRIBUTING.md': '# Contributing\n\nRun `npm test` before every commit. Keep the CLI free of dependencies; Node 20 is all it needs.\n',
};

const issue = (n: number, ws: string) => ({
  type: 'Harness/Issue',
  title: `Check ${n} in ${ws}`,
  card: `Finding ${n} of the nightly check in ${ws}.`,
  impact: [n % 4, 2, 1] as [number, number, number],
  references: [],
  extra: { source: 'consistency-check', category: 'gap', severity: 'low', options: [{ label: 'Fix it', change: `Fix finding ${n}.` }, { label: 'Leave it', change: 'Nothing to do.' }] },
});

// Overnight the consistency check runs in both projects; the graph build of todo-cli goes on while the feed has room
scenario('morning-triage', { enabled: [...PROJECTS], triggers: ['consistency-check'], settings: { feedSize: 60 } }, async ({ env, api, app, model, step }) => {
  /** What the build mapped and waits for the user: anything of todo-cli but the harness's own entities */
  const mapped = async () => (await api.feed()).items.filter((i) => i.workspace === 'todo-cli' && !i.type.startsWith('Harness/'));
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
    env.commit('todo-cli', DOCS, 'Write the docs');
    // The night's checks in both projects; the feed holds what they filed beside the waiting triggers
    for (const p of PROJECTS) expect((await api.automationRan(p, 'consistency-check', new Date(0), 20 * 60_000)).status).toBe('finished');
    await api.idle('handbook', 5 * 60_000);
    FEED = (await api.feed()).items.length + 2;
    await api.putSettings({ feedSize: FEED });
    // Then the build: it fills the feed and waits
    await api.call('PUT', '/workspaces/todo-cli/graph-build', { building: true });
    await until('the feed full', async () => (await api.feed()).items.length >= FEED, 20 * 60_000);
    await until('no build run open', async () => !(await api.runs('todo-cli', 'graph-build')).some((r) => r.status === 'queued' || r.status === 'running'), 20 * 60_000);
    await new Promise((r) => setTimeout(r, 10_000));
    const feed = await api.feed();
    expect(feed.items.length).toBe(FEED);
    expect(new Set(feed.items.map((i) => i.workspace))).toEqual(new Set(PROJECTS));
    // Paused, not done: no build run waits or runs while the feed is full
    expect((await api.graphBuild('todo-cli')).state).toBe('building');
    expect((await api.runs('todo-cli', 'graph-build')).filter((r) => r.status === 'queued' || r.status === 'running')).toEqual([]);
    const ranks = feed.items.map((i) => i.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  await step(1, async () => {
    const before = (await api.metrics('handbook')).attention;
    const items = (await api.feed()).items;
    const issues = items.filter((i) => i.type === 'Harness/Issue' && (i.issue?.options.length ?? 0) > 0);
    expect(issues.length, 'issues from the night').toBeGreaterThanOrEqual(2);
    // A quick pass through the top of the feed, the way a morning goes
    await app.resolve(issues[0]!.workspace, issues[0]!.path, issues[0]!.issue!.recommended ?? 0);
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
    const [faq] = await until('a mapped card in the feed', async () => {
      const rows = await mapped();
      return rows.length ? rows : null;
    }, 3 * 60_000);
    const seen = faq!.version;
    expect(seen).toBeTruthy();
    const chat = await api.chat(faq!.workspace, 'Rewrite this card as a short bulleted list, ending with a bullet naming the repository files it covers.', faq!.path);
    expect((await api.runEnded(chat.runId, 10 * 60_000)).status).toBe('finished');
    await expect(api.call('POST', `/feed/${encodeURIComponent(faq!.path)}/approve`, { workspace: faq!.workspace, timeSpentMs: 900, version: seen })).rejects.toMatchObject({ status: 409 });
    expect((await api.entity(faq!.workspace, faq!.path)).verification).toBe('unverified');
    // The card the user sees now is the new one; approving it works
    const now = await until('the new version in the feed', async () => (await api.feed()).items.find((i) => i.path === faq!.path && i.version !== seen));
    await api.call('POST', `/feed/${encodeURIComponent(faq!.path)}/approve`, { workspace: faq!.workspace, timeSpentMs: 900, version: now.version });
    expect((await api.entity(faq!.workspace, faq!.path)).verification).toBe('verified');
  });

  await step(3, async () => {
    // With room made, the paused build goes on until it is complete
    for (const item of [...(await mapped()), ...(await api.feed()).items.filter((i) => i.type === 'Harness/Trigger')].slice(0, 8)) await api.approve(item.workspace, item.path);
    await until('the build complete', async () => {
      const room = FEED - (await api.feed()).items.length;
      if (room < 2) for (const item of await mapped()) await api.approve(item.workspace, item.path);
      return (await api.graphBuild('todo-cli')).state === 'complete';
    }, 40 * 60_000, 5000);
    expect((await api.feed()).items.length).toBeLessThanOrEqual(FEED);
    expect((await api.graphBuild('todo-cli')).coverage).toBe(1);
    expect(env.files('todo-cli').filter((f) => !f.startsWith('knowledge-graph/Harness/')).length).toBeGreaterThan(0);
  });
});
