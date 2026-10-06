import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { EMBEDDING_DIMENSIONS, migrateHarness } from '@momentum/kb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scratchDatabase } from '../../../packages/kb/test/database.ts';
import { Approval } from '../src/approval.ts';
import { createBus } from '../src/events.ts';
import { Guard } from '../src/guard.ts';
import { HarnessSettings } from '../src/harness.ts';
import type { Runner } from '../src/runner.ts';
import { Timeline } from '../src/timeline.ts';
import { Conflict, Workspaces, type Workspace } from '../src/workspaces.ts';

// The approval rules over a real repository and index, without a server, runs or a model
const root = mkdtempSync(join(tmpdir(), 'momentum-approval-'));
const repo = join(root, 'shop');
const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@localhost', ...args], { cwd: repo, encoding: 'utf8' }).trim();

function entity(type: string, title: string, card: string, o: { verification?: string; sync?: string; references?: { to: string; relation: string }[] } = {}) {
  const refs = o.references?.length ? `\n${o.references.map((r) => `  - to: ${r.to}\n    relation: ${r.relation}`).join('\n')}` : ' []';
  return `---\ntype: ${type}\norigin: user\nverification: ${o.verification ?? 'verified'}\nsync: ${o.sync ?? 'synced'}\nproduct_impact: 2\ntimeline_impact: 2\nunlocks: 2\nreferences:${refs}\nartifacts: []\n---\n# ${title}\n\n${card}\n`;
}
const FILES: Record<string, string> = {
  'Product/Feature/search': entity('Product/Feature', 'Search', 'Find a book by its title.', { verification: 'unverified' }),
  // Approved, waiting for its implementation
  'Product/Feature/json-export': entity('Product/Feature', 'JSON export', 'Export the books as JSON.', { sync: 'entity_ahead' }),
  // What the implementation landed, for the user to approve
  'Architecture/Component/exporter': entity('Architecture/Component', 'Exporter', 'Writes the JSON export.', {
    verification: 'unverified',
    references: [{ to: 'Product/Feature/json-export', relation: 'implements' }],
  }),
};

let db: Awaited<ReturnType<typeof scratchDatabase>>;
let ws: Workspace;
let approval: Approval;

beforeAll(async () => {
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  for (const [path, text] of Object.entries(FILES)) {
    const file = join(repo, 'knowledge-graph', `${path}.md`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'Add the entities');

  db = await scratchDatabase('approval');
  await migrateHarness(db.sql);
  const settings = new HarnessSettings(db.sql);
  await db.sql`insert into harness.project (name, path, enabled) values ('shop', ${repo}, true)`;
  const timeline = new Timeline(db.sql);
  await timeline.migrate();
  const bus = createBus();
  const workspaces = new Workspaces(db.sql, settings);
  const embed = async (texts: string[]) => texts.map(() => new Array<number>(EMBEDDING_DIMENSIONS).fill(0.1));
  const guard = new Guard(workspaces, settings, bus, async (sources) => sources.map(() => ''), embed);
  approval = new Approval(workspaces, settings, guard, {} as Runner, bus, timeline);
  ws = await workspaces.get('shop');
  await guard.indexMainLine(ws, true);
}, 120_000);

afterAll(async () => {
  await db?.drop();
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('approval', () => {
  it('verifies an entity on the main line in one commit, takes it out of the feed and acts once', async () => {
    const start = git('rev-parse', 'main');
    expect(await ws.index.inFeed('Product/Feature/search')).toBe(true);
    await Promise.all([approval.approve('shop', 'Product/Feature/search', 1200), approval.approve('shop', 'Product/Feature/search', 900)]);
    const text = git('show', 'main:knowledge-graph/Product/Feature/search.md');
    expect(text).toMatch(/^verification: verified$/m);
    // Approved and implemented by nothing yet: it waits for an implementation
    expect(text).toMatch(/^sync: entity_ahead$/m);
    expect(git('rev-list', '--count', `${start}..main`)).toBe('1');
    expect(git('log', '-1', '--format=%s', 'main')).toBe('Approve Search');
    expect(await ws.index.inFeed('Product/Feature/search')).toBe(false);
    const reactions = await db.sql<{ reaction: string }[]>`select reaction from ws_shop.attention_metric where entity_path = 'Product/Feature/search'`;
    expect(reactions.map((r) => r.reaction)).toEqual(['approved']);
  });

  it('refuses a card that changed after the user saw it', async () => {
    const start = git('rev-parse', 'main');
    await expect(approval.approve('shop', 'Architecture/Component/exporter', 0, 'a version never shown')).rejects.toThrow(Conflict);
    expect(git('rev-parse', 'main')).toBe(start);
  });

  it('brings what an approved result implements back in sync, in the same commit', async () => {
    const version = await ws.index.version('Architecture/Component/exporter');
    await approval.approve('shop', 'Architecture/Component/exporter', 500, version!);
    expect(git('show', 'main:knowledge-graph/Architecture/Component/exporter.md')).toMatch(/^verification: verified$/m);
    expect(git('show', 'main:knowledge-graph/Product/Feature/json-export.md')).toMatch(/^sync: synced$/m);
    expect(git('log', '-1', '--format=%B', 'main')).toContain('Bring Product/Feature/json-export back in sync');
    expect((await ws.index.row('Product/Feature/json-export'))?.sync).toBe('synced');
  });
});
