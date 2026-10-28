import { migrateHarness, migrateWorkspace, type Sql } from '@momentum/kb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scratchDatabase } from '../../../packages/kb/test/database.ts';
import { createBus } from '../src/events.ts';
import { addStates, describeRun, reactionEvent, runEvent, Timeline } from '../src/timeline.ts';

// A database of its own: the timeline is harness-wide, so the live one is never touched
let db: Awaited<ReturnType<typeof scratchDatabase>>;
let sql: Sql;
let timeline: Timeline;
beforeAll(async () => {
  db = await scratchDatabase('timeline');
  sql = db.sql;
  await migrateHarness(sql);
  await sql`insert into harness.project (name, path, enabled) values ('shop', 'C:/Projects/shop', true)`;
  await migrateWorkspace(sql, 'shop');
  timeline = new Timeline(sql);
  await timeline.migrate();
}, 120_000);

afterAll(async () => {
  await db?.drop();
});

describe('timeline', () => {
  it('filters by project and actor and pages back from the newest', async () => {
    await timeline.record({ actor: 'harness', kind: 'project_disabled', workspace: 'shop', title: 'Disabled shop' });
    await timeline.record(reactionEvent('shop', { path: 'Product/Goal/a', type: 'Product/Goal', title: 'A' }, 'approved', { timeSpentMs: 4000 }));
    await timeline.record({ actor: 'user', kind: 'signed_in', title: 'Signed in' });
    await timeline.record(reactionEvent('shop', { path: 'Product/Goal/b', type: 'Product/Goal', title: 'B' }, 'sent_back', { detail: 'Split it', runId: 'c2' }));
    const all = await timeline.list({ limit: 100 });
    expect(all.events[0]!.kind).toBe('sent_back');
    expect(all.events[1]!.workspace).toBeNull();

    const shop = await timeline.list({ workspace: 'shop', limit: 100 });
    expect(shop.events.every((e) => e.workspace === 'shop')).toBe(true);
    const user = await timeline.list({ actor: 'user', limit: 100 });
    expect(user.events.map((e) => e.kind)).toEqual(['sent_back', 'signed_in', 'approved']);
    expect(user.events.find((e) => e.kind === 'approved')).toMatchObject({ title: 'Approved “A”', facts: { timeSpentMs: 4000 } });

    const first = await timeline.list({ limit: 3 });
    expect(first.events).toHaveLength(3);
    const second = await timeline.list({ limit: 100, before: first.next! });
    expect(second.next).toBeNull();
    expect([...first.events, ...second.events].map((e) => e.id)).toEqual(all.events.map((e) => e.id));
  });

  it('keeps one event per run, for what came of it: landed and ended, saying what it did and how it ran', async () => {
    const bus = createBus();
    timeline.listen(bus);
    const run = { id: 'g1', automation: 'graph-build', title: 'Knowledge graph', trigger: 'event' as const, model: 'sonnet' };
    await timeline.record({ actor: 'user', kind: 'signed_in', title: 'Signed in' });
    const base = { workspace: 'shop', automation: 'graph-build', message: 'Map the API\n\n- Books API', valid: true, issues: 0, removed: [], states: {} };
    // Landing and ending one right after the other, as a run does: neither is lost
    bus.emit('transaction', { ...base, runId: 'g1', commit: 'def', paths: ['Architecture/Api/a', 'Architecture/Api/b'], issues: 1, states: { unverified: 2, artifact_ahead: 2, updating: -2 } });
    await timeline.run(runEvent('shop', run, 'run_finished', { facts: { status: 'finished', durationMs: 5000, states: { updating: -1, synced: 1 } } }));

    const { events } = await timeline.list({ workspace: 'shop', limit: 100 });
    expect(events.filter((e) => e.runId === 'g1')).toHaveLength(1);
    expect(events[0]).toMatchObject({
      runId: 'g1',
      kind: 'run_finished',
      title: 'Map the API · 1 issue',
      detail: 'Map the API\n\n- Books API',
      facts: { trigger: 'event', model: 'sonnet', status: 'finished', durationMs: 5000, commit: 'def', issues: 1, paths: ['Architecture/Api/a', 'Architecture/Api/b'],
        // What landing and ending did to the counts, summed
        states: { unverified: 2, artifact_ahead: 2, updating: -3, synced: 1 } },
    });
  });

  it('drops the events of runs waiting or running, which the timeline no longer shows', async () => {
    for (const kind of ['run_queued', 'run_requeued', 'run_started', 'run_resumed']) {
      await sql`insert into harness.timeline_event (actor, kind, title, run_id, automation) values ('automation', ${kind}, 'Running', ${`old-${kind}`}, 'exploration')`;
    }
    await timeline.migrate();
    const left = await sql`select 1 from harness.timeline_event where run_id like 'old-%'`;
    expect(left).toHaveLength(0);
  });

  it('gives a chat one event, the user\'s, for what it lands, and skips a run that changed nothing', async () => {
    const bus = createBus();
    timeline.listen(bus);
    const base = { workspace: 'shop', automation: 'chat', message: 'Rename the goal', valid: true, issues: 0, removed: [], states: {} };
    bus.emit('transaction', { ...base, runId: 'c0', commit: null, paths: [] });
    bus.emit('transaction', { ...base, runId: 'c3', commit: 'fed', paths: ['Product/Goal/a'] });
    await new Promise((r) => setTimeout(r, 200));
    const { events } = await timeline.list({ workspace: 'shop', actor: 'user', limit: 10 });
    expect(events.map((e) => e.runId)).not.toContain('c0');
    expect(events[0]).toMatchObject({ runId: 'c3', kind: 'changes_landed', title: 'Rename the goal' });
  });

  it('keeps one event per chat: named as the chat is, for the latest thing done in it, with all it landed', async () => {
    const bus = createBus();
    timeline.listen(bus);
    const chat = { workspace: 'shop', actor: 'user' as const, runId: 'c4', automation: 'chat' };
    await timeline.record({ ...chat, kind: 'chat_started', title: 'Started a chat', detail: 'what does it mean?', facts: { runTitle: 'what does it mean?', states: { synced: -1, updating: 1 } } });
    const landing = { workspace: 'shop', runId: 'c4', automation: 'chat', valid: true, issues: 0, removed: [] };
    bus.emit('transaction', { ...landing, commit: 'abc', message: 'Explain level 0', paths: ['Product/Goal/a'], states: { updating: -1, synced: 1 } });
    await timeline.rename('c4', 'Make level 0 nodes the consensus layer');
    await timeline.record({ ...chat, kind: 'message_sent', title: 'what does it mean?', detail: 'And level 1?', facts: { runTitle: 'what does it mean?' } });
    bus.emit('transaction', { ...landing, commit: 'def', message: 'Explain level 1', paths: ['Product/Goal/b'], issues: 1, states: {} });
    await timeline.rename('c4', 'Explain levels 0 and 1');
    // Steering an automation run stays the user's own event, the latest of them
    await timeline.record({ workspace: 'shop', actor: 'user', kind: 'message_sent', title: 'Steered Exploration', detail: 'First', runId: 'e1', automation: 'exploration' });
    await timeline.record({ workspace: 'shop', actor: 'user', kind: 'message_sent', title: 'Steered Exploration', detail: 'Second', runId: 'e1', automation: 'exploration' });

    const { events } = await timeline.list({ workspace: 'shop', limit: 100 });
    const of = events.filter((e) => e.runId === 'c4');
    expect(of).toHaveLength(1);
    expect(of[0]).toMatchObject({
      actor: 'user',
      kind: 'message_sent',
      title: 'Explain levels 0 and 1',
      detail: 'And level 1?',
      facts: { runTitle: 'Explain levels 0 and 1', commit: 'def', subject: 'Explain level 1', issues: 1, paths: ['Product/Goal/a', 'Product/Goal/b'] },
    });
    // Started and landed: the entity went to updating and back, and nothing is left to show
    expect(of[0]!.facts.states).toBeUndefined();
    expect(events.filter((e) => e.runId === 'e1').map((e) => e.detail)).toEqual(['Second']);
  });

  it('keeps a stopped chat its name and says who stopped it', async () => {
    await timeline.record({ workspace: 'shop', actor: 'user', kind: 'chat_started', title: 'Started a chat', detail: 'Ask', runId: 'c6', automation: 'chat', facts: { runTitle: 'Ask' } });
    await timeline.run(runEvent('shop', { id: 'c6', automation: 'chat', title: 'Ask' }, 'run_killed', { byUser: true, facts: { status: 'killed' } }));
    const { events } = await timeline.list({ workspace: 'shop', limit: 100 });
    expect(events.filter((e) => e.runId === 'c6')).toEqual([expect.objectContaining({ actor: 'user', kind: 'run_killed', title: 'Ask', facts: expect.objectContaining({ byUser: true }) })]);
  });

  it('folds the events a chat once had, one per thing done in it, into one', async () => {
    const row = (actor: string, kind: string, title: string, detail: string | null, facts: object, at: string) =>
      sql`insert into harness.timeline_event (actor, kind, title, detail, run_id, automation, workspace, facts, at)
        values (${actor}, ${kind}, ${title}, ${detail}, 'c7', 'chat', 'shop', ${sql.json(facts as never)}, ${at})`;
    await sql`drop index harness.timeline_event_run_once`;
    await row('user', 'chat_started', 'Started a chat', 'what does it mean?', { states: { synced: -1, updating: 1 } }, '2026-10-01T10:00:00Z');
    await row('automation', 'changes_landed', 'Make level 0 nodes the consensus layer', 'Make level 0 nodes the consensus layer', { paths: ['Product/Goal/a'], issues: 0, commit: 'abc', states: { updating: -1, synced: 1 } }, '2026-10-01T10:05:00Z');
    await row('user', 'message_sent', 'Wrote in “what does it mean?”', 'Thanks', {}, '2026-10-01T10:06:00Z');
    await timeline.migrate();
    const rows = await sql<{ actor: string; kind: string; title: string; detail: string; facts: Record<string, unknown> }[]>`
      select actor, kind, title, detail, facts from harness.timeline_event where run_id = 'c7'`;
    expect(rows).toEqual([
      expect.objectContaining({ actor: 'user', kind: 'message_sent', title: 'what does it mean?', detail: 'Thanks', facts: expect.objectContaining({ commit: 'abc', paths: ['Product/Goal/a'] }) }),
    ]);
    expect(rows[0]!.facts.states).toBeUndefined();
  });

});

describe('state moves', () => {
  it('sum, subtract and keep only the states that moved', () => {
    expect(addStates({ unverified: 1, verified: 3 }, { unverified: 1, verified: 2 }, -1)).toEqual({ verified: 1 });
    expect(addStates(undefined, { synced: 2 })).toEqual({ synced: 2 });
    expect(addStates({ updating: 1 }, { updating: -1 })).toEqual({});
  });
});

describe('run titles', () => {
  it('say what a run did, why it failed or where it stands', () => {
    expect(describeRun('exploration', 'run_finished', {}, null)).toBe('No changes');
    expect(describeRun('summarization', 'run_finished', { paths: ['a', 'b'] }, null)).toBe('Updated 2 entities');
    expect(describeRun('implementation', 'run_failed', {}, 'Tests failed\nat step 3')).toBe('Failed: Tests failed');
    expect(describeRun('summarization', 'run_finished', { subject: 'Update Books API and 2 more', issues: 2 }, null)).toBe(
      'Update Books API and 2 more · 2 issues',
    );
    expect(runEvent('shop', { id: 'x', automation: 'consistency-check' }, 'run_killed').title).toBe('Stopped');
    expect(runEvent('shop', { id: 'x', automation: 'chat', title: 'Ask' }, 'run_killed', { byUser: true }).title).toBe('Stopped by you: Ask');
  });
});
