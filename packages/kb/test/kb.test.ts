import { parseEntity } from '@momentum/entity';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, createEmbedder, crossProjectFeed, migrateHarness, migrateWorkspace, WorkspaceIndex } from '../src/index.ts';

process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
const sql = connect();
const embed = createEmbedder();
const ws = `kbtest${process.pid}`;
const index = new WorkspaceIndex(sql, ws);
const fixture = parseEntity(readFileSync(join(import.meta.dirname, '../../entity/test/fixtures/private-mesh.md'), 'utf8'));

async function put(path: string, title: string, body: string, refs: { to: string; relation: string }[] = []) {
  const frontmatter = { ...fixture.frontmatter, type: path.split('/').slice(0, 2).join('/'), references: refs, artifacts: [] };
  const [embedding] = await embed([`${title}\n${body}`]);
  await index.upsert({ path, title, body, frontmatter, cardBlocks: [], branch: null, runId: null, embedding: embedding! });
  return frontmatter;
}

beforeAll(async () => {
  await migrateHarness(sql);
  await migrateWorkspace(sql, ws);
  await put('Architecture/Api/session', 'Session on the API', 'Per-user session token in an httpOnly cookie.');
  await put('Governance/Decision/remote-access/private-mesh', fixture.title, fixture.body, [
    { to: 'Architecture/Api/session', relation: 'depends_on' },
  ]);
  await put('Product/Feature/offline-feed', 'Offline feed', 'The last polled feed stays readable without the network.');
}, 180_000);

afterAll(async () => {
  await sql.unsafe(`drop schema if exists ${index.schema} cascade`);
  await sql.end();
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
