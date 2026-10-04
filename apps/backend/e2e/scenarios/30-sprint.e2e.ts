import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
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
  model.on('planning', (t) => t.automation === 'chat' && t.kind === 'prompt' && /plan the sprint/i.test(t.input), (t) => [
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
  let failExport = true;
  let open = () => {};
  const held = new Promise<void>((r) => (open = r));
  model.on('implementation', { automation: 'implementation', kind: 'prompt' }, (t) => {
    if (t.target === TASKS.export && failExport) return [move.error(400, 'Scripted: the request was refused')];
    if (t.target === TASKS.search) return [move.gate(held), move.write(t, 'src/find.js', 'export const find = (todos, words) => todos.filter((t) => t.text.includes(words));\n'), move.say('Search done.')];
    return t.target ? [move.write(t, `src/${t.target.split('/').pop()}.js`, '// done\n'), move.say('Done.')] : [move.say('Nothing to implement.')];
  });
  model.on('a question during the sprint', (t) => t.automation === 'chat' && t.kind === 'prompt' && /how far/i.test(t.input), () => [move.say('Search is being implemented.')]);

  await step(0, async () => {
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    const chat = await app.chat(WS, 'Plan the sprint: search, CSV export and sync across devices.');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    const feed = await until('the plan in the feed', async () => {
      const items = (await api.feed()).items.filter((i) => i.type === 'Product/DevTask');
      return items.length === 3 ? items : null;
    });
    // Ranked by impact: search, then sync, then export
    expect(feed.map((i) => i.path)).toEqual([TASKS.search, TASKS.sync, TASKS.export]);
    await app.approve(WS, SPRINT);
  });

  await step(1, async () => {
    const chat = await app.sendBack(WS, TASKS.sync, 'Too big for one task: split the file format from the command.');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    await app.approve(WS, RETIRE);
    expect(env.show(WS, `knowledge-graph/${TASKS.sync}.md`)).toBeNull();
    for (const p of SPLIT) expect((await api.feed()).items.map((i) => i.path)).toContain(p);
  });

  await step(2, async () => {
    const since = new Date();
    await app.approve(WS, TASKS.search);
    await app.approve(WS, TASKS.export);
    const search = await until('search under way', async () => (await api.runs(WS, 'implementation')).find((r) => r.target_path === TASKS.search && r.status === 'running'), 2 * 60_000);
    // The user asks how it goes; the chat answers at once, beside the implementation
    const chat = await app.chat(WS, 'How far is the sprint?');
    expect((await api.runEnded(chat, 2 * 60_000)).status).toBe('finished');
    expect((await api.runs(WS, 'implementation')).find((r) => r.target_path === TASKS.export)?.status).toBe('queued');
    open();
    expect((await api.runEnded(search.id, 3 * 60_000)).status).toBe('finished');
    const exp = await until('the export run to end', async () => (await api.runs(WS, 'implementation')).find((r) => r.target_path === TASKS.export && r.status === 'failed'), 3 * 60_000);
    // In approval order, one at a time
    expect(+exp.started_at!).toBeGreaterThanOrEqual(+(await api.runs(WS, 'implementation')).find((r) => r.id === search.id)!.ended_at!);
    expect(exp.created_at >= since).toBe(true);
  });

  await step(3, async () => {
    // The export failed: it is still to do, and the user starts it again on demand
    expect((await api.entity(WS, TASKS.export)).sync).toBe('entity_ahead');
    failExport = false;
    const { runId } = await api.mcp<{ runId: string }>('run_automation', { workspace: WS, automation: 'implementation', target_path: TASKS.export });
    const retry = await api.runEnded(runId, 3 * 60_000);
    expect(retry.status).toBe('finished');
    expect(retry.targetPath).toBe(TASKS.export);
    expect(env.show(WS, 'src/export-to-csv.js')).toBe('// done');
  });

  await step(4, async () => {
    const m = await api.metrics(WS);
    expect(m.agents.automations.find((a) => a.automation === 'implementation')?.runs.value).toBe(3);
    expect(m.attention.approved.value).toBeGreaterThanOrEqual(4);
    expect(m.attention.sentBack.value).toBe(1);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=200`);
    const failed = events.find((e) => e.kind === 'run_failed' && e.automation === 'implementation');
    expect(failed?.detail).toContain('Scripted: the request was refused');
    await app.tab('Timeline');
    await app.tab('Metrics');
  });
});
