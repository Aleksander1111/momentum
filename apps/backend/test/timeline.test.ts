import { migrateHarness, migrateWorkspace, type Sql } from '@momentum/kb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scratchDatabase } from '../../../packages/kb/test/database.ts';
import { createBus } from '../src/events.ts';
import { describeRun, reactionEvent, runEvent, Timeline } from '../src/timeline.ts';

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

  it('keeps one event per run: queued, running, landed and ended, saying what it did', async () => {
    const bus = createBus();
    timeline.listen(bus);
    const run = { id: 'g1', automation: 'graph-build', title: 'Knowledge graph' };
    await timeline.run(runEvent('shop', run, 'run_queued', { facts: { trigger: 'event' } }));
    expect((await timeline.list({ limit: 1 })).events[0]!.title).toBe('Queued by an event: Knowledge graph');
    await timeline.record({ actor: 'user', kind: 'signed_in', title: 'Signed in' });
    await timeline.run(runEvent('shop', run, 'run_started', { facts: { model: 'sonnet' } }));
    expect((await timeline.list({ limit: 1 })).events[0]!.title).toBe('Running: Knowledge graph');
    const base = { workspace: 'shop', automation: 'graph-build', message: 'Map the API\n\n- Books API', valid: true, issues: 0, conflicts: [], removed: [] };
    // Landing and ending one right after the other, as a run does: neither is lost
    bus.emit('transaction', { ...base, runId: 'g1', commit: 'def', paths: ['Architecture/Api/a', 'Architecture/Api/b'], issues: 1 });
    await timeline.run(runEvent('shop', run, 'run_finished', { facts: { status: 'finished', durationMs: 5000 } }));

    const { events } = await timeline.list({ workspace: 'shop', limit: 100 });
    expect(events.filter((e) => e.runId === 'g1')).toHaveLength(1);
    expect(events[0]).toMatchObject({
      runId: 'g1',
      kind: 'run_finished',
      title: 'Map the API · 1 issue',
      detail: 'Map the API\n\n- Books API',
      facts: { trigger: 'event', model: 'sonnet', status: 'finished', durationMs: 5000, commit: 'def', issues: 1, paths: ['Architecture/Api/a', 'Architecture/Api/b'] },
    });
  });

  it('gives a chat an event only for what it lands, and skips a run that changed nothing', async () => {
    const bus = createBus();
    timeline.listen(bus);
    const base = { workspace: 'shop', automation: 'chat', message: 'Rename the goal', valid: true, issues: 0, conflicts: [], removed: [] };
    bus.emit('transaction', { ...base, runId: 'c0', commit: null, paths: [] });
    bus.emit('transaction', { ...base, runId: 'c3', commit: 'fed', paths: ['Product/Goal/a'] });
    await new Promise((r) => setTimeout(r, 200));
    const { events } = await timeline.list({ workspace: 'shop', actor: 'automation', limit: 10 });
    expect(events.map((e) => e.runId)).not.toContain('c0');
    expect(events[0]).toMatchObject({ runId: 'c3', kind: 'changes_landed', title: 'Rename the goal' });
  });

});

describe('run titles', () => {
  it('say what a run did, why it failed or where it stands', () => {
    expect(runEvent('shop', { id: 'x', automation: 'summarization', title: 'Main line changes (2)' }, 'run_queued', { facts: { trigger: 'event' } }).title).toBe(
      'Queued by an event: Main line changes (2)',
    );
    expect(describeRun('exploration', 'run_finished', {}, null)).toBe('No changes');
    expect(describeRun('summarization', 'run_finished', { paths: ['a', 'b'] }, null)).toBe('Updated 2 entities');
    expect(describeRun('implementation', 'run_failed', {}, 'Tests failed\nat step 3')).toBe('Failed: Tests failed');
    expect(describeRun('summarization', 'run_finished', { subject: 'Update Books API and 2 more', conflicts: ['a'] }, null)).toBe(
      'Update Books API and 2 more · 1 conflict',
    );
    expect(runEvent('shop', { id: 'x', automation: 'consistency-check' }, 'run_killed').title).toBe('Stopped');
    expect(runEvent('shop', { id: 'x', automation: 'chat', title: 'Ask' }, 'run_killed', { byUser: true }).title).toBe('Stopped by you: Ask');
  });
});
