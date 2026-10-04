import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { BOOK_ROUTES_JS, missingArtifacts } from '../support/life.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const STORE = 'Architecture/Component/book-store';
const DESIGN = 'Governance/DesignDoc/design';
const RETIRE = 'Harness/Plan/retire-the-design-doc';
const kg = (p: string) => `knowledge-graph/${p}.md`;

/** An entity in the checkout with its artifacts replaced, unverified as summarization leaves it */
const reartifact = (t: Turn, path: string, artifacts: string[]) =>
  readFileSync(t.file(kg(path)), 'utf8')
    .replace('verification: verified', 'verification: unverified')
    .replace(/artifacts:\n(  - .*\n)+/, `artifacts:\n${artifacts.map((a) => `  - ${a}\n`).join('')}`);

// The graph is built; the developers refactor the code under it
scenario('refactoring', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  const summarization = (since: Date) => api.automationRan(WS, 'summarization', since, 3 * 60_000);
  const artifactsOf = async (path: string) => (await api.entity(WS, path)).artifacts.map((a) => a.path).sort();

  // Summarization follows the files: renamed, split out, deleted
  model.on('summarization', { automation: 'summarization', kind: 'prompt' }, (t) => {
    const moves = [];
    if (/book-store\.js|- Architecture\/Component\/book-store: src\/store\.js/.test(t.input)) {
      const store = env.show(WS, 'src/store.js') === null ? 'src/book-store.js' : 'src/store.js';
      moves.push(move.write(t, kg(STORE), reartifact(t, STORE, [store])));
    }
    if (/routes\/books\.js/.test(t.input)) moves.push(move.write(t, kg(API), reartifact(t, API, ['src/routes/books.js', 'src/server.js'])));
    if (/- Governance\/DesignDoc\/design: docs\/design\.md/.test(t.input)) {
      const api = readFileSync(t.file(kg(API)), 'utf8')
        .replace('verification: verified', 'verification: unverified')
        .replace(`  - to: ${DESIGN}\n    relation: implements\n`, '');
      moves.push(
        move.write(t, kg(API), api),
        move.entity(t, RETIRE, {
          type: 'Harness/Plan',
          title: 'Retire the design document',
          card: '`docs/design.md` was deleted; the API card says what it said.',
          impact: [1, 0, 0],
          references: [{ to: DESIGN, relation: 'retires' }],
        }),
      );
    }
    return [...moves, move.say('Followed the files.')];
  });

  await step(0, async () => {
    const since = new Date();
    env.git(WS, 'mv', 'src/store.js', 'src/book-store.js');
    env.commit(WS, { 'src/server.js': env.show(WS, 'src/server.js')!.replace("from './store.js'", "from './book-store.js'") }, 'Rename the store module');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    await until('the store card follows the file', async () => (await artifactsOf(STORE)).join() === 'src/book-store.js');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    await app.approve(WS, STORE);
  });

  await step(1, async () => {
    const since = new Date();
    env.commit(
      WS,
      {
        'src/routes/books.js': BOOK_ROUTES_JS,
        'src/server.js': `${env.show(WS, 'src/server.js')!}\n// Routes live in src/routes/books.js\n`,
      },
      'Split the routes out of the server',
    );
    const runs = await until('the split summarized', async () => {
      const rows = (await api.runs(WS, 'summarization')).filter((r) => r.created_at >= since);
      return rows.length && rows.every((r) => r.status === 'finished') ? rows : null;
    }, 3 * 60_000);
    // The new file and the changed one are summarized together into the API card
    expect(runs).toHaveLength(1);
    await until('the API card lists both files', async () => (await artifactsOf(API)).join() === 'src/routes/books.js,src/server.js');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    await app.approve(WS, API);
  });

  await step(2, async () => {
    const since = new Date();
    env.commit(WS, { 'docs/design.md': null }, 'Drop the outdated design document');
    expect((await summarization(since)).status).toBe('finished');
    await until('the retirement in the feed', async () => (await api.feed()).items.some((i) => i.path === RETIRE));
    await app.approve(WS, API);
    await app.approve(WS, RETIRE);
    expect(env.show(WS, kg(DESIGN))).toBeNull();
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
  });

  await step(3, async () => {
    // The rename broke an import elsewhere: the developer undoes it
    const since = new Date();
    env.git(WS, 'mv', 'src/book-store.js', 'src/store.js');
    env.commit(WS, { 'src/server.js': env.show(WS, 'src/server.js')!.replace("from './book-store.js'", "from './store.js'") }, 'Undo the store rename');
    expect((await summarization(since)).status).toBe('finished');
    await until('the store card follows the revert', async () => (await artifactsOf(STORE)).join() === 'src/store.js');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    expect(graphIssues(env, WS)).toEqual([]);
    expect((await api.metrics(WS)).understanding.consistency.value).toBe(1);
  });
});
