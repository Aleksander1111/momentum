import { parseEntity } from '@momentum/entity';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmbedder, crossProjectFeed, migrateHarness, migrateWorkspace, pruneHarness, pruneWorkspace, WorkspaceIndex, type Sql } from '../src/index.ts';
import { scratchDatabase } from './database.ts';

const embed = createEmbedder();
const ws = 'kbtest';
let db: Awaited<ReturnType<typeof scratchDatabase>>;
let sql: Sql;
let index: WorkspaceIndex;
const fixture = parseEntity(readFileSync(join(import.meta.dirname, '../../entity/test/fixtures/private-mesh.md'), 'utf8'));

async function put(path: string, title: string, body: string, refs: { to: string; relation: string }[] = []) {
  const frontmatter = { ...fixture.frontmatter, type: path.split('/').slice(0, 2).join('/'), references: refs, artifacts: [] };
  const [embedding] = await embed([`${title}\n${body}`]);
  await index.upsert({ path, title, body, frontmatter, cardBlocks: [], cardDiff: null, embedding: embedding! });
  return frontmatter;
}

beforeAll(async () => {
  db = await scratchDatabase('kb');
  sql = db.sql;
  index = new WorkspaceIndex(sql, ws);
  await migrateHarness(sql);
  await migrateWorkspace(sql, ws);
  await put('Architecture/Api/session', 'Session on the API', 'Per-user session token in an httpOnly cookie.');
  await put('Governance/Decision/remote-access/private-mesh', fixture.title, fixture.body, [
    { to: 'Architecture/Api/session', relation: 'depends_on' },
  ]);
  await put('Product/Feature/offline-feed', 'Offline feed', 'The last polled feed stays readable without the network.');
}, 180_000);

afterAll(() => db?.drop());

describe('migrations', () => {
  it('run again on a database they built, keeping what it holds', async () => {
    const before = await index.paths();
    await migrateHarness(sql);
    await migrateWorkspace(sql, ws);
    await migrateHarness(sql);
    await migrateWorkspace(sql, ws);
    expect(await index.paths()).toEqual(before);
    expect(before.size).toBe(3);
  });

  it('refuse a value the contract does not have', async () => {
    const run = (automation: string, status: string) =>
      sql.unsafe(`insert into ws_kbtest.run (id, automation, checkout, trigger, status) values ($1, $2, 'x', 'event', $3)`, [`${automation}-${status}`, automation, status]);
    await run('exploration', 'queued');
    await expect(run('mapping', 'queued')).rejects.toThrow(/run_automation_check/);
    await expect(run('exploration', 'paused')).rejects.toThrow(/run_status_check/);
    await expect(sql.unsafe(`update ws_kbtest.entity set sync = 'stale'`)).rejects.toThrow(/entity_sync_check/);
  });

  it('prune expired sessions and readings older than the metrics show, and nothing else', async () => {
    await sql`insert into harness.session (token_hash, expires_at) values ('gone', now() - interval '1 minute'), ('kept', now() + interval '1 day')`;
    await sql`insert into harness.usage_sample (at, five_hour, week) values (now() - interval '40 days', 1, 1), (now() - interval '20 days', 2, 2)`;
    await sql`insert into ws_kbtest.usage_share (run_id, automation, recorded_at) values ('old', 'chat', now() - interval '40 days'), ('new', 'chat', now())`;
    await pruneHarness(sql);
    await pruneWorkspace(sql, ws);
    expect((await sql`select token_hash from harness.session`).map((r) => r.token_hash)).toEqual(['kept']);
    expect((await sql`select five_hour from harness.usage_sample`).map((r) => r.five_hour)).toEqual([2]);
    expect((await sql`select run_id from ws_kbtest.usage_share`).map((r) => r.run_id)).toEqual(['new']);
  });
});

describe('workspace index', () => {
  it('returns detail with references in both directions', async () => {
    const d = await index.detail('Architecture/Api/session');
    expect(d?.references).toEqual([
      expect.objectContaining({ path: 'Governance/Decision/remote-access/private-mesh', relation: 'depends_on', direction: 'in' }),
    ]);
  });

  it('groups entities by type path', async () => {
    const { total, types } = await index.types();
    expect(total).toBe(3);
    expect(types.map((t) => t.name).sort()).toEqual(['Architecture', 'Governance', 'Product']);
  });

  it('finds entities by full text and meaning', async () => {
    const [q] = await embed(['WireGuard']);
    expect((await index.search('WireGuard', q!))[0]?.path).toBe('Governance/Decision/remote-access/private-mesh');
    const [v] = await embed(['reading cards while offline on a plane']);
    expect((await index.search('plane', v!))[0]?.path).toBe('Product/Feature/offline-feed');
  });

  it('finds entities for a question by meaning and by any of its words', async () => {
    const question = 'How do I reach the API from outside the house?';
    const [v] = await embed([question]);
    expect((await index.search(question, v!)).slice(0, 2).map((r) => r.path)).toContain('Governance/Decision/remote-access/private-mesh');
    // Without meaning, the words alone still find it: any of them, not all
    expect((await index.search('which session token does the cookie hold', null)).map((r) => r.path)).toContain('Architecture/Api/session');
  });

  it('expands search hits along references', async () => {
    const [q] = await embed(['WireGuard']);
    const paths = (await index.retrieve('WireGuard', q!, 1, 1)).map((r) => r.path);
    expect(paths).toEqual(['Governance/Decision/remote-access/private-mesh', 'Architecture/Api/session']);
  });

  it('ranks the feed across projects', async () => {
    await index.enterFeed('Governance/Decision/remote-access/private-mesh', { ...fixture.frontmatter });
    await index.enterFeed('Product/Feature/offline-feed', { ...fixture.frontmatter, product_impact: 5, timeline_impact: 5, unlocks: 5 });
    const feed = await crossProjectFeed(sql, [ws], 10);
    expect(feed.map((f) => [f.path, f.rank])).toEqual([
      ['Product/Feature/offline-feed', 15],
      ['Governance/Decision/remote-access/private-mesh', 9],
    ]);
    await index.leaveFeed('Product/Feature/offline-feed');
    expect(await index.feedCount()).toBe(1);
  });
});
