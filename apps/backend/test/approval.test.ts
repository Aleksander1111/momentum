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
const onMain = () => git('ls-tree', '-r', '--name-only', 'main', 'knowledge-graph');

function entity(type: string, title: string, card: string, o: { verification?: string; references?: { to: string; relation: string }[] } = {}) {
  const refs = o.references?.length ? `\n${o.references.map((r) => `  - to: ${r.to}\n    relation: ${r.relation}`).join('\n')}` : ' []';
  return `---\ntype: ${type}\norigin: user\nverification: ${o.verification ?? 'verified'}\nsync: synced\nproduct_impact: 2\ntimeline_impact: 2\nunlocks: 2\nreferences:${refs}\nartifacts: []\n---\n# ${title}\n\n${card}\n`;
}
const FILES: Record<string, string> = {
  'Product/Feature/search': entity('Product/Feature', 'Search', 'Find a book by its title.', { verification: 'unverified' }),
  'Product/Feature/csv-export': entity('Product/Feature', 'CSV export', 'Export the books as CSV.'),
  'Product/Feature/json-export': entity('Product/Feature', 'JSON export', 'Export the books as JSON.'),
  'Architecture/Component/exporter': entity('Architecture/Component', 'Exporter', 'Writes the JSON export.', {
    references: [{ to: 'Product/Feature/json-export', relation: 'implements' }],
  }),
  'Harness/Plan/retire-exports': entity('Harness/Plan', 'Retire the exports', 'Nobody exports any more.', {
    verification: 'unverified',
    references: [
      { to: 'Product/Feature/csv-export', relation: 'retires' },
      { to: 'Product/Feature/json-export', relation: 'retires' },
    ],
  }),
};

let db: Awaited<ReturnType<typeof scratchDatabase>>;
let ws: Workspace;
let approval: Approval;

beforeAll(async () => {
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  // The plan comes in a commit of its own, as a run proposes it: what lands with it is part of its proposal
  for (const group of [Object.keys(FILES).filter((p) => !p.startsWith('Harness/')), ['Harness/Plan/retire-exports']]) {
    for (const path of group) {
      const file = join(repo, 'knowledge-graph', `${path}.md`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, FILES[path]!);
    }
    git('add', '-A');
    git('commit', '-q', '-m', `Add ${group.length} entities`);
  }

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
    await expect(approval.approve('shop', 'Harness/Plan/retire-exports', 0, 'a version never shown')).rejects.toThrow(Conflict);
    expect(onMain()).toContain('knowledge-graph/Harness/Plan/retire-exports.md');
  });

  it('retires what nothing else references, keeps the rest, and is carried out with them', async () => {
    const version = await ws.index.version('Harness/Plan/retire-exports');
    await approval.approve('shop', 'Harness/Plan/retire-exports', 500, version!);
    const files = onMain();
    expect(files).not.toContain('knowledge-graph/Product/Feature/csv-export.md');
    expect(files).toContain('knowledge-graph/Product/Feature/json-export.md');
    expect(files).not.toContain('knowledge-graph/Harness/Plan/retire-exports.md');
    const message = git('log', '-1', '--format=%B', 'main');
    expect(message).toContain('Retire Product/Feature/csv-export');
    expect(message).toContain('Keep Product/Feature/json-export: still referenced by Architecture/Component/exporter');
    expect(message).toContain('Carried out, Harness/Plan/retire-exports is retired with them');
    expect(await ws.index.row('Product/Feature/csv-export')).toBeNull();
  });
});
