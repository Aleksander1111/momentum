import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { git } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { missingArtifacts } from '../support/life.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const STORE = 'Architecture/Component/book-store';
const SEARCH = 'Architecture/Component/search';
const TESTS = 'Testing/TestSuite/books-tests';
const kg = (p: string) => `knowledge-graph/${p}.md`;

/** The card of an entity in the checkout with a line added, unverified as summarization leaves it */
const noted = (t: Turn, path: string, line: string) =>
  readFileSync(t.file(kg(path)), 'utf8').replace('verification: verified', 'verification: unverified').trimEnd() + `\n- ${line}\n`;

// The graph is built; pull requests are merged into the main line every day
scenario('pull-requests', { enabled: [WS], graphBuild: 'complete', settings: { summarization: { exclude: ['package-lock.json'] } } }, async ({ env, api, app, model, step }) => {
  const dir = env.path(WS);
  const summaries = (since: Date) => api.runs(WS, 'summarization').then((r) => r.filter((x) => x.created_at >= since));
  const settled = (since: Date, n: number) =>
    until(`${n} summarization runs done`, async () => {
      const rows = await summaries(since);
      return rows.length === n && rows.every((r) => r.status === 'finished') ? rows : null;
    }, 3 * 60_000);
  let gate: Promise<void> | null = null;

  /** A pull request: a branch with the developer's commits, merged into main with a merge commit */
  const merge = (branch: string, files: Record<string, string | null>, message: string) => {
    git(dir, 'checkout', '-q', '-b', branch, 'main');
    for (const [f, text] of Object.entries(files)) {
      if (text === null) git(dir, 'rm', '-q', f);
      else writeFileSync(join(dir, f), text);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', message);
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'merge', '-q', '--no-ff', '-m', `Merge pull request: ${message}`, branch);
    return git(dir, 'rev-parse', 'HEAD');
  };

  model.on('summarization', { automation: 'summarization', kind: 'prompt' }, (t) => {
    const moves = gate ? [move.gate(gate)] : [];
    for (const [, entity, files] of t.input.matchAll(/^- ([A-Z]\S+): (.+)$/gm)) {
      const exists = files!.split(', ').filter((f) => env.show(WS, f) !== null);
      moves.push(move.write(t, kg(entity!), noted(t, entity!, `Follows ${exists.join(', ') || 'nothing now'} as of ${t.run}.`)));
    }
    for (const [, file] of t.input.matchAll(/^- ((?:src|test)\/\S+)$/gm)) {
      if (file === 'src/search.js') {
        moves.push(move.entity(t, SEARCH, { type: 'Architecture/Component', title: 'Search', card: '`search(books, q)` finds books by title or author.', references: [{ to: API, relation: 'part_of' }], artifacts: [file] }));
      } else if (file!.startsWith('test/')) {
        moves.push(move.entity(t, TESTS, { type: 'Testing/TestSuite', title: 'Books tests', card: 'Route and search tests.', references: [{ to: API, relation: 'concerns' }], artifacts: [file!] }));
      }
    }
    return [...moves, move.say('Summarized.')];
  });

  await step(0, async () => {
    const since = new Date();
    merge(
      'search',
      {
        'src/search.js': 'export const search = (books, q) => books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(q.toLowerCase()));\n',
        'src/server.js': env.show(WS, 'src/server.js')!.replace("import { createStore } from './store.js';", "import { createStore } from './store.js';\nimport { search } from './search.js';"),
        'test/search.test.js': "import { test } from 'node:test';\n\ntest('search finds by author', () => {});\n",
      },
      'Search books by title or author',
    );
    const [run] = await settled(since, 1);
    const asked = model.turns(run!.id)[0]!.input;
    expect(asked).toContain(`- ${API}: src/server.js`);
    expect(asked).toMatch(/- src\/search\.js[\s\S]*- test\/search\.test\.js/);
    const feed = (await api.feed()).items.map((i) => i.path);
    expect(feed).toEqual(expect.arrayContaining([API, SEARCH, TESTS]));
    for (const p of [API, SEARCH, TESTS]) await app.approve(WS, p);
  });

  await step(1, async () => {
    let open!: () => void;
    gate = new Promise<void>((r) => (open = r));
    const since = new Date();
    merge('ids', { 'src/store.js': env.show(WS, 'src/store.js')!.replace('return list.find((book) => book.id === id);', 'return list.find((book) => book.id === Number(id));') }, 'Accept string ids');
    await until('the first summarization under way', async () => (await summaries(since)).some((r) => model.turns(r.id).length > 0), 2 * 60_000);
    merge('years', { 'src/store.js': env.show(WS, 'src/store.js')!.replace('const book = { id: list.length + 1, title, author, year };', 'const book = { id: list.length + 1, title, author, year: year ?? null };') }, 'Store a missing year as null');
    await until('the second merge noticed', async () => (await summaries(since)).length === 2, 60_000);
    gate = null;
    open();
    const [second, first] = await settled(since, 2);
    expect(+second!.started_at!).toBeGreaterThanOrEqual(+first!.ended_at!);
    await until('the store card on the latest', async () => (await api.entity(WS, STORE)).markdown.includes(second!.id) && (await api.entity(WS, STORE)).sync === 'synced');
    await app.approve(WS, STORE);
  });

  await step(2, async () => {
    const since = new Date();
    merge(
      'deps',
      {
        'package-lock.json': JSON.stringify({ name: 'bookshelf-api', lockfileVersion: 3, packages: {} }, null, 2),
        'test/search.test.js': "import { test } from 'node:test';\n\ntest('search finds by author', () => {});\ntest('search ignores case', () => {});\n",
      },
      'Lock dependencies and test case-insensitive search',
    );
    const [run] = await settled(since, 1);
    const asked = model.turns(run!.id)[0]!.input;
    expect(asked).toContain(`- ${TESTS}: test/search.test.js`);
    // The lockfile is excluded: never summarized
    expect(asked).not.toContain('package-lock.json');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
  });

  await step(3, async () => {
    const pr = git(dir, 'log', '--format=%H', '--grep=Merge pull request: Accept string ids', 'main');
    const since = new Date();
    git(dir, 'revert', '--no-edit', '-m', '1', pr);
    const [run] = await settled(since, 1);
    expect(env.show(WS, 'src/store.js')).not.toContain('Number(id)');
    // The store card follows the revert, and the later pull request's change stays
    expect(env.show(WS, 'src/store.js')).toContain('year: year ?? null');
    await until('the store card follows', async () => (await api.entity(WS, STORE)).markdown.includes(run!.id));
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
  });
});
