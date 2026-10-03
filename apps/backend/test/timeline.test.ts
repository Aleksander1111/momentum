import { connect, migrateHarness, migrateWorkspace, type Sql } from '@momentum/kb';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBus } from '../src/events.ts';
import { describeRun, reactionEvent, runEvent, Timeline } from '../src/timeline.ts';

process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
// A database of its own: the timeline is harness-wide, so the live one is never touched
const url = new URL(process.env.DATABASE_URL!);
const name = `momentum_timeline_${process.pid}`;
const admin = postgres(new URL('/postgres', url).toString(), { onnotice: () => {} });
url.pathname = `/${name}`;
let sql: Sql;
let timeline: Timeline;
// The project's repository, where what a run landed is read from its commit
const repo = mkdtempSync(join(tmpdir(), 'momentum-timeline-'));
const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

beforeAll(async () => {
  git('init', '-q');
  writeFileSync(join(repo, 'goals.md'), '# Goals\n');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'Summarize the goals\n\nThe body');
  const commit = git('rev-parse', 'HEAD');

  await admin.unsafe(`create database ${name}`);
  sql = connect(url.toString());
  await migrateHarness(sql);
  await sql`insert into harness.project (name, path, enabled) values ('shop', ${repo}, true)`;
  await migrateWorkspace(sql, 'shop');
  // History from before the timeline: a scheduled run, a chat, a reaction and what the run landed
  await sql.unsafe(`insert into ws_shop.run (id, automation, checkout, trigger, status, title, created_at, started_at, ended_at, model, usage_five_hour)
    values ('r1', 'exploration', 'x', 'schedule', 'finished', 'Main line changes (1)', $1, $2, $3, 'opus', 1.5),
           ('c1', 'chat', 'x', 'on_demand', 'finished', 'Ask', $4, $4, $5, null, null)`, [ago(60), ago(59), ago(50), ago(40), ago(39)]);
  await sql.unsafe(`insert into ws_shop.run_message (run_id, seq, role, text) values ('c1', 1, 'user', 'Which routes are there?')`);
  await sql.unsafe(`insert into ws_shop.transaction (run_id, commit, paths, status, created_at) values ('r1', $1, '{Product/Goal/a}', 'validated', $2)`, [commit, ago(50)]);
  await sql.unsafe(`insert into ws_shop.attention_metric (entity_path, entity_type, time_spent_ms, reaction, recorded_at)
    values ('Product/Goal/a', 'Product/Goal', 4000, 'approved', $1)`, [ago(30)]);
  timeline = new Timeline(sql);
  await timeline.migrate();
}, 120_000);

afterAll(async () => {
  await sql?.end();
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.end();
  rmSync(repo, { recursive: true, force: true });
});

describe('timeline', () => {
  it('starts with the history the projects already hold, one event per run saying what it did, oldest first', async () => {
    const { events } = await timeline.list({ limit: 100 });
    expect(events.map((e) => e.kind).reverse()).toEqual(['run_finished', 'chat_started', 'approved']);
    const finished = events.find((e) => e.kind === 'run_finished')!;
    expect(finished).toMatchObject({ workspace: 'shop', actor: 'automation', runId: 'r1', title: 'Summarize the goals' });
    expect(finished.facts).toMatchObject({
      trigger: 'schedule',
      status: 'finished',
      model: 'opus',
      durationMs: 9 * 60_000,
      usage: { fiveHour: 1.5 },
      paths: ['Product/Goal/a'],
      subject: 'Summarize the goals',
    });
    expect(events.find((e) => e.kind === 'chat_started')).toMatchObject({ actor: 'user', detail: 'Which routes are there?' });
    expect(events.find((e) => e.kind === 'approved')).toMatchObject({ title: 'Approved “a”', facts: { timeSpentMs: 4000 } });
  });

  it('filters by project and actor and pages back from the newest', async () => {
    await timeline.record({ actor: 'user', kind: 'signed_in', title: 'Signed in' });
    await timeline.record(reactionEvent('shop', { path: 'Product/Goal/b', type: 'Product/Goal', title: 'B' }, 'sent_back', { detail: 'Split it', runId: 'c2' }));
    const all = await timeline.list({ limit: 100 });
    expect(all.events[0]!.kind).toBe('sent_back');
    expect(all.events[1]!.workspace).toBeNull();

    const shop = await timeline.list({ workspace: 'shop', limit: 100 });
    expect(shop.events.every((e) => e.workspace === 'shop')).toBe(true);
    const user = await timeline.list({ actor: 'user', limit: 100 });
    expect(user.events.map((e) => e.kind)).toEqual(['sent_back', 'signed_in', 'approved', 'chat_started']);

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
    const base = { workspace: 'shop', automation: 'graph-build', message: 'Map the API\n\n- Books API', valid: true, issues: 0, conflicts: [] };
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
    const base = { workspace: 'shop', automation: 'chat', message: 'Rename the goal', valid: true, issues: 0, conflicts: [] };
    bus.emit('transaction', { ...base, runId: 'c0', commit: null, paths: [] });
    bus.emit('transaction', { ...base, runId: 'c3', commit: 'fed', paths: ['Product/Goal/a'] });
    await new Promise((r) => setTimeout(r, 200));
    const { events } = await timeline.list({ workspace: 'shop', actor: 'automation', limit: 10 });
    expect(events.map((e) => e.runId)).not.toContain('c0');
    expect(events[0]).toMatchObject({ runId: 'c3', kind: 'changes_landed', title: 'Rename the goal' });
  });

  it('rebuilds run events kept another way, keeping what the user did', async () => {
    await sql`insert into harness.timeline_event (actor, kind, title) values ('harness', 'artifact_ahead', 'Artifacts changed under 3 entities')`;
    await sql.unsafe(`comment on table harness.timeline_event is '2'`);
    const users = (await timeline.list({ actor: 'user', limit: 100 })).events.length;
    await new Timeline(sql).migrate();
    const { events } = await timeline.list({ limit: 100 });
    expect(events.some((e) => (e.kind as string) === 'artifact_ahead')).toBe(false);
    expect(events.filter((e) => e.runId === 'r1')).toMatchObject([{ title: 'Summarize the goals' }]);
    expect(events.filter((e) => e.actor === 'user')).toHaveLength(users);
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
