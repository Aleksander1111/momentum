import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'todo-cli';
const ISSUE = 'Harness/Issue/no-tests-for-the-cli';
const DRAFT = 'Product/Feature/due-dates';
const PRIORITIES = 'Product/Feature/priorities';
const REMINDERS = 'Product/Feature/reminders';
const NOTES = 'Product/Feature/notes';

const feature = (title: string, card: string, references: { to: string; relation: string }[] = []) =>
  entityText({ type: 'Product/Feature', origin: 'requested', title, card, references });
// Over the card limit, and depending on an entity that does not exist
const invalid = (title: string) => feature(title, `${title} for to-dos. ${'Every detail spelled out at length. '.repeat(30)}`, [{ to: 'Product/Feature/tags', relation: 'depends_on' }]);

// The consistency check's trigger is approved: its schedule is due at once
scenario('interruptions', { enabled: [WS], triggers: ['consistency-check'] }, async ({ env, api, app, model, step }) => {
  const run = (id: string) => env.sql<{ status: string; restarts: number }[]>`select status, restarts from ${env.sql('ws_todo_cli.run')} where id = ${id}`.then((r) => r[0]!);
  const restart = async () => {
    env.stop();
    await env.start();
    await app.open();
  };
  const hasTurn = (id: string, kind: string) => model.turns(id).some((t) => t.kind === kind);

  // Works, then waits on the model until the harness goes down
  model.on('consistency check', { automation: 'consistency-check', kind: 'prompt' }, (t) => [
    move.entity(t, ISSUE, {
      type: 'Harness/Issue',
      title: 'No tests for the CLI',
      card: 'Only the store has tests; `src/cli.js` has none.',
      references: [],
      extra: { source: 'consistency-check', category: 'gap', severity: 'low', options: [{ label: 'Add tests', change: 'Test each command.' }, { label: 'Leave it', change: 'The CLI is thin.' }] },
    }),
    move.hang(),
  ]);
  model.on('resumes after the restart', { automation: 'consistency-check', kind: 'resume' }, () => [move.say('Picked up where I left off; one issue filed.')]);
  model.on('chat drafts then waits', (t) => t.automation === 'chat' && t.kind === 'prompt' && /due dates/.test(t.input), (t) => [
    move.entity(t, DRAFT, { type: 'Product/Feature', origin: 'requested', title: 'Due dates', card: 'Each to-do can carry a due date; `list` shows overdue items first.' }),
    move.hang(),
  ]);
  model.on('chat answers after the restart', (t) => t.automation === 'chat' && t.kind === 'message' && /still there/.test(t.input), () => [move.say('Yes: the due dates feature landed.')]);

  await step(0, async () => {
    const r = await until('the check to wait on the model after writing', async () => {
      const [x] = await api.runs(WS, 'consistency-check');
      return x && model.turns(x.id).some((t) => t.step === 1) ? x : null;
    }, 2 * 60_000);
    await restart();
    const ended = await api.runEnded(r.id, 3 * 60_000);
    expect(ended.status).toBe('finished');
    expect((await run(r.id)).restarts).toBe(1);
    expect(hasTurn(r.id, 'resume')).toBe(true);
    expect(env.show(WS, `knowledge-graph/${ISSUE}.md`)).not.toBeNull();
    const landed = await env.sql<{ commit: string | null }[]>`select commit from ${env.sql('ws_todo_cli.transaction')} where run_id = ${r.id}`;
    expect(landed.filter((t) => t.commit)).toHaveLength(1);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=100`);
    // One event per run, kept up to date through the restart
    expect(events.filter((e) => e.runId === r.id).map((e) => e.kind)).toEqual(['run_finished']);
  });

  await step(1, async () => {
    const chat = await app.chat(WS, 'Draft a feature for due dates.');
    await until('the chat to wait on the model after writing', async () => model.turns(chat).some((t) => t.step === 1), 2 * 60_000);
    await restart();
    const r = await api.runEnded(chat, 2 * 60_000);
    expect(r.status).toBe('failed');
    expect(r.error).toBe('lost at restart');
    expect(env.show(WS, `knowledge-graph/${DRAFT}.md`)).toContain('overdue items first');
    expect((await api.feed()).items.map((i) => i.path)).toContain(DRAFT);
    await app.reply(chat, 'Are you still there?');
    await until('the chat to answer after the restart', async () => {
      const x = await api.run(chat);
      return x.status === 'finished' && x.messages.some((m) => m.role === 'assistant' && m.text.includes('due dates feature landed'));
    }, 3 * 60_000);
  });

  model.on('writes a bad entity, then fixes it', (t) => t.automation === 'chat' && /priorities/.test(t.inputs[0] ?? ''), (t) => {
    if (t.kind === 'prompt') return [move.write(t, `knowledge-graph/${PRIORITIES}.md`, invalid('Priorities')), move.say('Written.')];
    if (t.kind === 'guard') return [move.write(t, `knowledge-graph/${PRIORITIES}.md`, feature('Priorities', 'Each to-do has a priority: low, normal or high; `list` sorts by it.')), move.say('Fixed.')];
    return undefined;
  });
  model.subject = (t) => (/priorities/.test(t.inputs[0] ?? '') ? 'Add priorities to to-dos' : `Scripted ${t.automation} work`);

  await step(2, async () => {
    const chat = await app.chat(WS, 'Add a feature for priorities.');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    const turns = model.turns(chat);
    // Told by the PostToolUse hook right after the write, then held at the stop until it fixed the entity
    expect(turns.find((t) => t.kind === 'prompt' && t.step === 1)?.flagged).toBe(true);
    expect(turns.some((t) => t.kind === 'guard')).toBe(true);
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await api.entities(WS, 'Harness/Issue')).toHaveLength(1);
    const [t] = await env.sql<{ commit: string; status: string }[]>`select commit, status from ${env.sql('ws_todo_cli.transaction')} where run_id = ${chat} and commit is not null`;
    expect(t!.status).toBe('validated');
    expect(env.git(WS, 'log', '-1', '--format=%s', t!.commit)).toBe('Add priorities to to-dos');
  });

  model.on('writes a bad entity and leaves it', (t) => t.automation === 'chat' && /reminders/.test(t.inputs[0] ?? ''), (t) =>
    t.kind === 'prompt' ? [move.write(t, `knowledge-graph/${REMINDERS}.md`, invalid('Reminders')), move.say('Written.')] : t.kind === 'guard' ? [move.say('It is fine as it is.')] : undefined,
  );

  await step(3, async () => {
    const chat = await app.chat(WS, 'Add a feature for reminders.');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    expect(model.turns(chat).filter((t) => t.kind === 'guard' && t.step === 0)).toHaveLength(2);
    expect(env.show(WS, `knowledge-graph/${REMINDERS}.md`)).not.toBeNull();
    const issue = `Harness/Issue/guard-${chat}`;
    const raised = await api.entity(WS, issue);
    expect(raised.markdown).toContain(REMINDERS);
    expect(raised.references.map((r) => r.path)).toContain(REMINDERS);
    expect((await api.feed()).items.map((i) => i.path)).toContain(issue);
    const [t] = await env.sql<{ status: string }[]>`select status from ${env.sql('ws_todo_cli.transaction')} where run_id = ${chat} and commit is not null`;
    expect(t!.status).toBe('invalid');
  });

  model.on('writes, then keeps going', (t) => t.automation === 'chat' && t.kind === 'prompt' && /notes/.test(t.input), (t) => [
    move.write(t, `knowledge-graph/${NOTES}.md`, feature('Notes', 'A to-do can carry a free-text note, shown by `list --long`.')),
    move.hang(),
  ]);

  await step(4, async () => {
    const chat = await app.chat(WS, 'Add a feature for notes, then keep researching.');
    await until('the chat to wait on the model after writing', async () => model.turns(chat).some((t) => t.step === 1), 2 * 60_000);
    await app.go(`/chat/${chat}`);
    await app.text('Stop').click();
    expect((await api.runEnded(chat, 60_000)).status).toBe('killed');
    expect(env.show(WS, `knowledge-graph/${NOTES}.md`)).toContain('list --long');
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=100`);
    expect(events.find((e) => e.runId === chat && e.kind === 'run_killed')?.title).toMatch(/^Stopped by you/);
  });
});
