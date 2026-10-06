import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, entitiesOf, refs } from '../support/landed.ts';
import { entityText, move, type Turn } from '../support/scripted.ts';

const WS = 'todo-cli';
const ISSUE = 'Harness/Issue/no-tests-for-the-cli';
const DRAFT = 'Product/Feature/due-dates';
const PRIORITIES = 'Product/Feature/priorities';
const REMINDERS = 'Product/Feature/reminders';
const NOTES = 'Product/Feature/notes';
/** The user's own entity, depending on one that does not exist: what the consistency check has to find */
const LISTING = 'Product/Feature/listing';

const feature = (title: string, card: string, references: { to: string; relation: string }[] = []) =>
  entityText({ type: 'Product/Feature', origin: 'requested', title, card, references });
// Depending on an entity that does not exist
const invalid = (title: string) => feature(title, `${title} for to-dos.`, [{ to: 'Product/Feature/tags', relation: 'depends_on' }]);

/** The run has written an entity under a type path: the moment a fault cuts it off */
const wroteUnder = (t: Turn, type: string) => t.wrote.some((f) => f.startsWith(`knowledge-graph/${type}/`));

scenario('interruptions', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  const run = (id: string) => env.sql<{ status: string; restarts: number }[]>`select status, restarts from ${env.sql('ws_todo_cli.run')} where id = ${id}`.then((r) => r[0]!);
  const restart = async () => {
    env.stop();
    await env.start();
    await app.open();
  };
  const hasTurn = (id: string, kind: string) => model.turns(id).some((t) => t.kind === kind);
  /** The API stopped answering the run: the fault below cut it off */
  const cutOff = (id: string) => model.turns(id).some((t) => t.move.startsWith('injected'));

  // Works, then the API stops answering until the harness goes down: a hang injected at the network, live too
  model.on('consistency check', { automation: 'consistency-check', kind: 'prompt' }, (t) => [
    move.entity(t, ISSUE, {
      type: 'Harness/Issue',
      title: 'The listing depends on a missing entity',
      card: '`Product/Feature/listing` depends on `Product/Feature/tags`, which does not exist.',
      references: [{ to: LISTING, relation: 'concerns' }],
      extra: { source: 'consistency_check', category: 'reference', options: [{ label: 'Drop the reference', change: 'The listing no longer depends on tags.' }, { label: 'Add tags', change: 'Write the tags feature.' }] },
    }),
    move.say('One issue filed.'),
  ]);
  model.on('cut off after filing', { automation: 'consistency-check', kind: 'prompt' }, (t) => (wroteUnder(t, 'Harness/Issue') ? [move.hang()] : undefined));
  model.on('resumes after the restart', { automation: 'consistency-check', kind: 'resume' }, () => [move.say('Picked up where I left off; one issue filed.')]);
  model.on('chat drafts', (t) => t.automation === 'chat' && t.kind === 'prompt' && /due dates/.test(t.input), (t) => [
    move.entity(t, DRAFT, { type: 'Product/Feature', origin: 'requested', title: 'Due dates', card: 'Each to-do can carry a due date; `list` shows overdue items first.' }),
    move.say('Drafted.'),
  ]);
  model.on('chat cut off after drafting', (t) => t.automation === 'chat' && t.kind === 'prompt' && /due dates/.test(t.input) && wroteUnder(t, 'Product/Feature'), () => [move.hang()]);
  model.on('chat answers after the restart', (t) => t.automation === 'chat' && t.kind === 'message' && /still there/.test(t.input), () => [move.say('Yes: the due dates feature landed.')]);

  await step(0, async () => {
    // The user's listing feature depends on a tags feature nobody wrote; then the nightly check is approved, due at once
    env.commit(
      WS,
      {
        [`knowledge-graph/${LISTING}.md`]: entityText({
          type: 'Product/Feature',
          origin: 'user',
          verification: 'verified',
          title: 'Listing',
          card: '`list` prints every to-do, open ones first; it will group them by tag.',
          references: [{ to: 'Product/Feature/tags', relation: 'depends_on' }],
        }),
      },
      'Describe the listing',
    );
    const since = new Date();
    await app.approve(WS, 'Harness/Trigger/consistency-check');
    const r = await until('the check to be cut off after filing an issue', async () => {
      const x = (await api.runs(WS, 'consistency-check')).find((x) => x.created_at >= since);
      return x && cutOff(x.id) ? x : null;
    }, 15 * 60_000);
    await restart();
    const ended = await api.runEnded(r.id, 15 * 60_000);
    expect(ended.status).toBe('finished');
    expect((await run(r.id)).restarts).toBe(1);
    expect(hasTurn(r.id, 'resume')).toBe(true);
    // What it filed before the restart landed, once: an issue over the broken reference
    expect(await commitsOf(env, WS, r.id)).toHaveLength(1);
    const issues = await Promise.all((await entitiesOf(env, WS, r.id)).filter((p) => p.startsWith('Harness/Issue/')).map((p) => api.entity(WS, p)));
    expect(issues.some((i) => refs(i, 'concerns').includes(LISTING)), 'an issue concerning the listing').toBe(true);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=100`);
    // One event per run, kept up to date through the restart
    expect(events.filter((e) => e.runId === r.id).map((e) => e.kind)).toEqual(['run_finished']);
  });

  await step(1, async () => {
    const chat = await app.chat(WS, 'Write a Product/Feature entity for due dates: each to-do can carry a due date, and `list` shows overdue items first.');
    await until('the chat to be cut off after writing', async () => cutOff(chat), 10 * 60_000);
    await restart();
    const r = await api.runEnded(chat, 2 * 60_000);
    expect(r.status).toBe('failed');
    expect(r.error).toBe('lost at restart');
    // What it wrote landed all the same, and waits in the feed
    const drafted = (await entitiesOf(env, WS, chat)).filter((p) => p.startsWith('Product/Feature/'));
    expect(drafted.length, 'the drafted feature on the main line').toBeGreaterThan(0);
    expect(drafted.some((p) => /overdue/i.test(env.show(WS, `knowledge-graph/${p}.md`)!))).toBe(true);
    expect((await api.feed()).items.map((i) => i.path)).toEqual(expect.arrayContaining(drafted));
    // The next message resumes the same session
    await app.reply(chat, 'Are you still there?');
    expect((await api.answered(chat, 2, 10 * 60_000)).status).toBe('finished');
    const resumed = model.turns(chat).find((t) => t.kind === 'message' && /still there/.test(t.input));
    expect(resumed, 'the reply reached the same conversation').toBeTruthy();
  });

  model.on('writes a bad entity, then fixes it', (t) => t.automation === 'chat' && /priorities/.test(t.inputs[0] ?? ''), (t) => {
    if (t.kind === 'prompt') return [move.write(t, `knowledge-graph/${PRIORITIES}.md`, invalid('Priorities')), move.say('Written.')];
    if (t.kind === 'guard') return [move.write(t, `knowledge-graph/${PRIORITIES}.md`, feature('Priorities', 'Each to-do has a priority: low, normal or high; `list` sorts by it.')), move.say('Fixed.')];
    return undefined;
  });
  model.subject = (t) => (/priorities/.test(t.inputs[0] ?? '') ? 'Add priorities to to-dos' : `Scripted ${t.automation} work`);

  await step(2, async () => {
    const issuesBefore = (await api.entities(WS, 'Harness/Issue')).length;
    const { runId: chat } = await api.chat(
      WS,
      `Add a feature for priorities. Write knowledge-graph/${PRIORITIES}.md with exactly this content, then end your turn at once without checking anything; if a check stops you when you end it, fix what it says then:\n\n${invalid('Priorities')}`,
    );
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    const turns = model.turns(chat);
    // Told by the PostToolUse hook right after the write; it fixed the entity then, or when the Stop hook held it (step 3
    // holds a run at the stop for sure)
    expect(turns.some((t) => t.kind === 'prompt' && t.flagged)).toBe(true);
    // Nothing it wrote is left invalid; the user's listing still waits on its own issue
    expect(graphIssues(env, WS).filter((i) => i.path !== LISTING)).toEqual([]);
    expect(await api.entities(WS, 'Harness/Issue')).toHaveLength(issuesBefore);
    const [t] = await env.sql<{ commit: string; status: string }[]>`select commit, status from ${env.sql('ws_todo_cli.transaction')} where run_id = ${chat} and commit is not null`;
    expect(t!.status).toBe('validated');
    // Under the message the run wrote, not the harness's fallback
    expect(env.git(WS, 'log', '-1', '--format=%s', t!.commit)).toMatch(/priorit/i);
  });

  model.on('writes a bad entity and leaves it', (t) => t.automation === 'chat' && /reminders/.test(t.inputs[0] ?? ''), (t) =>
    t.kind === 'prompt' ? [move.write(t, `knowledge-graph/${REMINDERS}.md`, invalid('Reminders')), move.say('Written.')] : t.kind === 'guard' ? [move.say('It is fine as it is.')] : undefined,
  );

  await step(3, async () => {
    const { runId: chat } = await api.chat(
      WS,
      `Add a feature for reminders. Write knowledge-graph/${REMINDERS}.md with exactly this content and end your turn. Keep the file exactly as written: do not fix, change or remove it, whatever a check says; I will review it myself.\n\n${invalid('Reminders')}`,
    );
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
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
    move.say('Written.'),
  ]);
  model.on('still at it', (t) => t.automation === 'chat' && t.kind === 'prompt' && /notes/.test(t.input) && wroteUnder(t, 'Product/Feature'), () => [move.hang()]);

  await step(4, async () => {
    const chat = await app.chat(WS, 'Write a Product/Feature entity for notes: a to-do can carry a free-text note, shown by `list --long`. Then keep researching what else the CLI needs.');
    await until('the chat to be busy after writing', async () => cutOff(chat), 10 * 60_000);
    await app.go(`/chat/${chat}`);
    await app.text('Stop').click();
    expect((await api.runEnded(chat, 60_000)).status).toBe('killed');
    // What it wrote so far landed
    const written = (await entitiesOf(env, WS, chat)).filter((p) => p.startsWith('Product/Feature/'));
    expect(written.some((p) => /list --long/.test(env.show(WS, `knowledge-graph/${p}.md`)!))).toBe(true);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=100`);
    expect(events.find((e) => e.runId === chat && e.kind === 'run_killed')?.title).toMatch(/^Stopped by you/);
  });
});
