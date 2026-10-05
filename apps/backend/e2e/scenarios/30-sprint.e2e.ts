import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, entitiesOf, filesOf, refs, testsPass } from '../support/landed.ts';
import { TODO_GRAPH } from '../support/life.ts';
import { move } from '../support/scripted.ts';

const WS = 'todo-cli';
const PRODUCT = 'Product/Product/todo-cli';
const SPRINT = 'Product/Sprint/sprint-12';
const TASKS = {
  search: 'Product/DevTask/search-to-dos',
  export: 'Product/DevTask/export-to-csv',
  sync: 'Product/DevTask/sync-across-devices',
};
const SPLIT = ['Product/DevTask/sync-file-format', 'Product/DevTask/sync-command'];
const RETIRE = 'Harness/Plan/retire-sync-task';
const PLANNING =
  'Set up sprint 12 in the knowledge base: a Product/Sprint entity, and one Product/DevTask for each item, planned in the sprint: search to-dos, export to CSV, and sync across devices. Search matters most, then sync, then the CSV export. Do not implement anything yet.';

const task = (title: string, card: string, impact: [number, number, number]) => ({
  type: 'Product/DevTask',
  origin: 'requested' as const,
  title,
  card,
  impact,
  references: [
    { to: PRODUCT, relation: 'part_of' },
    { to: SPRINT, relation: 'planned_in' },
  ],
});

// Implementation runs on approved tasks
scenario('sprint', { enabled: [WS], graphBuild: 'complete', triggers: ['implementation'] }, async ({ env, api, app, model, step }) => {
  model.on('planning', (t) => t.automation === 'chat' && t.kind === 'prompt' && /sprint 12/i.test(t.input), (t) => [
    move.entity(t, SPRINT, { type: 'Product/Sprint', origin: 'requested', title: 'Sprint 12', card: 'Two weeks: search, CSV export and syncing to-dos across devices.', references: [{ to: PRODUCT, relation: 'part_of' }] }),
    move.entity(t, TASKS.search, task('Search to-dos', '`todo find <words>` lists the to-dos containing them.', [4, 3, 2])),
    move.entity(t, TASKS.export, task('Export to CSV', '`todo export` writes the list as CSV.', [2, 1, 1])),
    move.entity(t, TASKS.sync, task('Sync across devices', 'Keep the list in a synced folder and merge edits from two machines.', [3, 2, 3])),
    move.say('Planned four entities for sprint 12.'),
  ]);
  model.on('splitting', (t) => t.automation === 'chat' && t.target === TASKS.sync && t.kind === 'prompt', (t) => [
    move.entity(t, SPLIT[0]!, task('Sync file format', 'A list file two machines can merge: one line per to-do with an id and a timestamp.', [3, 2, 3])),
    move.entity(t, SPLIT[1]!, { ...task('Sync command', '`todo sync <folder>` merges the list with the copy in the folder.', [3, 2, 2]), references: [...task('', '', [0, 0, 0]).references, { to: SPLIT[0]!, relation: 'depends_on' }] }),
    move.entity(t, RETIRE, { type: 'Harness/Plan', title: 'Retire the sync task', card: 'Split into the file format and the command.', impact: [1, 0, 0], references: [{ to: TASKS.sync, relation: 'retires' }] }),
    move.say('Split it in two.'),
  ]);
  /** The tasks as the chat named them */
  const tasks = { search: '', export: '', sync: '' };
  let failExport = true;
  let open = () => {};
  const held = new Promise<void>((r) => (open = r));
  model.on('implementation', { automation: 'implementation', kind: 'prompt' }, (t) => {
    // The API refuses the export's first try: an outage, injected at the network, live too
    if (t.target === tasks.export && failExport) return [move.error(400, 'Injected: the request was refused')];
    // Search waits to start until the user has asked how the sprint goes: held at the network, live too
    if (t.target === tasks.search) return [move.gate(held), move.write(t, 'src/find.js', 'export const find = (todos, words) => todos.filter((t) => t.text.includes(words));\n'), move.say('Search done.')];
    return t.target ? [move.write(t, `src/${t.target.split('/').pop()}.js`, '// done\n'), move.say('Done.')] : [move.say('Nothing to implement.')];
  });
  // Summarization, as the sub-agent does it: a component over the code, implementing the task
  model.on('implementation summarizes', { automation: 'implementation', kind: 'summarize' }, (t) => {
    const code = [...t.input.matchAll(/^- (src\/\S+) \(/gm)].map((m) => m[1]!);
    if (!t.target || !code.length) return undefined;
    const name = t.target.split('/').pop()!;
    return [
      move.entity(t, `Architecture/Component/${name}`, { type: 'Architecture/Component', title: name, card: `The code of ${t.target}.`, references: [{ to: t.target, relation: 'implements' }], artifacts: code }),
      move.say('Summarized.'),
    ];
  });
  model.on('a question during the sprint', (t) => t.automation === 'chat' && t.kind === 'prompt' && /how far/i.test(t.input), () => [move.say('Search is being implemented.')]);

  await step(0, async () => {
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    const chat = await app.chat(WS, PLANNING);
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    const written = await Promise.all((await entitiesOf(env, WS, chat)).map((p) => api.entity(WS, p)));
    const sprints = written.filter((e) => e.type === 'Product/Sprint');
    expect(sprints, 'the sprint').toHaveLength(1);
    const sprint = sprints[0]!.path;
    // Linked to the sprint either way: the task planned in it, or the sprint planning the task
    const planned = written.filter((e) => e.type === 'Product/DevTask' && e.references.some((r) => r.path === sprint));
    expect(planned.map((e) => e.path), 'three tasks planned in the sprint').toHaveLength(3);
    const named = (re: RegExp) => planned.find((e) => re.test(`${e.path} ${e.title}`))!.path;
    tasks.search = named(/search|find/i);
    tasks.export = named(/csv|export/i);
    tasks.sync = named(/sync/i);
    // Ranked by the impact set on them, which follows what the user said matters most
    const feed = await until('the tasks in the feed', async () => {
      const items = (await api.feed()).items.filter((i) => planned.some((e) => e.path === i.path));
      return items.length === 3 ? items : null;
    });
    expect(feed.map((i) => i.path)).toEqual([tasks.search, tasks.sync, tasks.export]);
    await app.approve(WS, sprint);
  });

  await step(1, async () => {
    const chat = await app.sendBack(WS, tasks.sync, 'Too big for one task: split it into one task for the sync file format and one for the sync command, and retire this one.');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    const written = await Promise.all((await entitiesOf(env, WS, chat)).map((p) => api.entity(WS, p)));
    const split = written.filter((e) => e.type === 'Product/DevTask' && e.path !== tasks.sync);
    expect(split.length, 'the tasks it was split into').toBeGreaterThanOrEqual(2);
    const plans = written.filter((e) => e.type === 'Harness/Plan' && refs(e, 'retires').includes(tasks.sync));
    expect(plans, 'a plan retiring the sync task').toHaveLength(1);
    await app.approve(WS, plans[0]!.path);
    expect(env.show(WS, `knowledge-graph/${tasks.sync}.md`)).toBeNull();
    for (const p of split) expect((await api.feed()).items.map((i) => i.path)).toContain(p.path);
  });

  await step(2, async () => {
    const since = new Date();
    await app.approve(WS, tasks.search);
    await app.approve(WS, tasks.export);
    const search = await until('search under way', async () => (await api.runs(WS, 'implementation')).find((r) => r.target_path === tasks.search && r.status === 'running'), 2 * 60_000);
    // The user asks how it goes; the chat answers at once, beside the implementation
    const chat = await app.chat(WS, 'How far is the sprint?');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    expect((await api.runs(WS, 'implementation')).find((r) => r.target_path === tasks.export)?.status).toBe('queued');
    open();
    expect((await api.runEnded(search.id, 30 * 60_000)).status).toBe('finished');
    const exp = await until('the export run to end', async () => (await api.runs(WS, 'implementation')).find((r) => r.target_path === tasks.export && r.status === 'failed'), 5 * 60_000);
    // In approval order, one at a time
    expect(+exp.started_at!).toBeGreaterThanOrEqual(+(await api.runs(WS, 'implementation')).find((r) => r.id === search.id)!.ended_at!);
    expect(exp.created_at >= since).toBe(true);
  });

  await step(3, async () => {
    // The export failed: it is still to do, and the user starts it again on demand
    expect((await api.entity(WS, tasks.export)).sync).toBe('entity_ahead');
    failExport = false;
    const { runId } = await api.mcp<{ runId: string }>('run_automation', { workspace: WS, automation: 'implementation', target_path: tasks.export });
    const retry = await api.runEnded(runId, 30 * 60_000);
    expect(retry.status).toBe('finished');
    expect(retry.targetPath).toBe(tasks.export);
    // It landed code, the suite passes, and what it summarized implements the task
    expect(filesOf(env, WS, await commitsOf(env, WS, runId)).some((f) => f.startsWith('src/'))).toBe(true);
    expect(testsPass(env, WS)).toBe(true);
    const results = (await Promise.all((await entitiesOf(env, WS, runId)).map((p) => api.entity(WS, p)))).filter((e) => refs(e, 'implements').includes(tasks.export));
    expect(results.length, 'an entity implementing the export').toBeGreaterThan(0);
  });

  await step(4, async () => {
    const m = await api.metrics(WS);
    // Every implementation run counted: search, the export twice, and any the approved plans started
    const runs = await api.runs(WS, 'implementation');
    expect(runs.filter((r) => [tasks.search, tasks.export].includes(r.target_path ?? ''))).toHaveLength(3);
    expect(m.agents.automations.find((a) => a.automation === 'implementation')?.runs.value).toBe(runs.length);
    expect(m.attention.approved.value).toBeGreaterThanOrEqual(4);
    expect(m.attention.sentBack.value).toBe(1);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=200`);
    const failed = events.find((e) => e.kind === 'run_failed' && e.automation === 'implementation');
    expect(failed?.detail).toContain('Injected: the request was refused');
    await app.tab('Timeline');
    await app.tab('Metrics');
  });
});
