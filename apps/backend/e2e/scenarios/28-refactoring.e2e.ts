import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entitiesOf, refs } from '../support/landed.ts';
import { BOOK_ROUTES_JS, missingArtifacts } from '../support/life.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const STORE = 'Architecture/Component/book-store';
const DESIGN = 'Governance/DesignDoc/design';
const RETIRE = 'Harness/Plan/retire-the-design-doc';
const kg = (p: string) => `knowledge-graph/${p}.md`;
/** The server once its routes are split out: it hands every request to them and answers 404 for the rest */
const SPLIT_SERVER = `import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createStore } from './book-store.js';
import { books } from './routes/books.js';

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  return JSON.parse(text || '{}');
}

/** The /books routes of src/routes/books.js; anything else is 404 */
export function createApp(store = createStore()) {
  return createServer(async (req, res) => {
    try {
      if ((await books(req, res, store, { send, readJson })) !== false) return;
    } catch {
      return send(res, 400, { error: 'body must be JSON' });
    }
    send(res, 404, { error: 'not found' });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(\`bookshelf-api listening on http://localhost:\${port}\`));
}
`;

/** An entity in the checkout with its artifacts replaced, unverified as summarization leaves it */
const reartifact = (t: Turn, path: string, artifacts: string[]) =>
  readFileSync(t.file(kg(path)), 'utf8')
    .replace('verification: verified', 'verification: unverified')
    .replace(/artifacts:\n(  - .*\n)+/, `artifacts:\n${artifacts.map((a) => `  - ${a}\n`).join('')}`);

// The graph is built; the user refactors the code under it
scenario('refactoring', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  const summarization = (since: Date) => api.automationRan(WS, 'summarization', since, 10 * 60_000);
  /** Approves what a run left waiting in the feed */
  const approveAll = async (runId: string) => {
    const feed = (await api.feed()).items.map((i) => i.path);
    for (const p of await entitiesOf(env, WS, runId)) if (feed.includes(p)) await app.approve(WS, p);
  };
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
    // Told it moved, not that one file went and another came
    expect(model.turns(run.id)[0]!.input).toMatch(/src\/store\.js \(moved to src\/book-store\.js/);
    await until('the store card follows the file', async () => (await artifactsOf(STORE)).join() === 'src/book-store.js');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    await approveAll(run.id);
  });

  await step(1, async () => {
    const since = new Date();
    env.commit(
      WS,
      { 'src/routes/books.js': BOOK_ROUTES_JS, 'src/server.js': SPLIT_SERVER },
      'Split the routes out of the server',
    );
    const runs = await until('the split summarized', async () => {
      const rows = (await api.runs(WS, 'summarization')).filter((r) => r.created_at >= since);
      return rows.length && rows.every((r) => r.status === 'finished') ? rows : null;
    }, 10 * 60_000);
    // The new file and the changed one are summarized together, under the API
    expect(runs).toHaveLength(1);
    const asked = model.turns(runs[0]!.id)[0]!.input;
    expect(asked).toContain('src/server.js');
    expect(asked).toContain('src/routes/books.js');
    expect(await artifactsOf(API)).toContain('src/server.js');
    const routes = (await env.sql<{ entity_path: string }[]>`select entity_path from ${env.sql('ws_bookshelf_api.entity_artifact')} where artifact_path = 'src/routes/books.js'`).map((r) => r.entity_path);
    const underApi = await Promise.all(routes.map(async (p) => p === API || refs(await api.entity(WS, p), 'part_of').includes(API) || (await api.entity(WS, p)).references.some((r) => r.direction === 'out' && r.path === API)));
    expect(underApi.some(Boolean), `src/routes/books.js under the API, among ${routes.join(', ')}`).toBe(true);
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    await approveAll(runs[0]!.id);
  });

  await step(2, async () => {
    const since = new Date();
    env.commit(WS, { 'docs/design.md': null }, 'Drop the outdated design document');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toMatch(/docs\/design\.md \(deleted\)/);
    // Its entity, left with no artifact, is proposed for retirement
    const plans = (await Promise.all((await entitiesOf(env, WS, run.id)).map((p) => api.entity(WS, p)))).filter(
      (e) => e.type === 'Harness/Plan' && refs(e, 'retires').includes(DESIGN),
    );
    expect(plans, 'a plan retiring the design document').toHaveLength(1);
    const plan = plans[0]!.path;
    // The API still says it implements the design: the user has the reference dropped from the API's page
    const holding = async () => (await api.referencing(WS, DESIGN)).filter((p) => p !== plan);
    if ((await holding()).length) {
      const { runId } = await api.chat(WS, `The design document was deleted: drop every reference to ${DESIGN} from this card.`, API);
      expect((await api.runEnded(runId, 10 * 60_000)).status).toBe('finished');
      expect(await holding()).toEqual([]);
      await approveAll(runId);
    }
    // Once nothing references it, approving the plan retires it
    await approveAll(run.id);
    expect(env.show(WS, kg(DESIGN))).toBeNull();
    expect(await api.referencing(WS, DESIGN)).toEqual([]);
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
  });

  await step(3, async () => {
    // The rename broke an import elsewhere: the user undoes it
    const since = new Date();
    env.git(WS, 'mv', 'src/book-store.js', 'src/store.js');
    env.commit(WS, { 'src/server.js': env.show(WS, 'src/server.js')!.replace("from './book-store.js'", "from './store.js'") }, 'Undo the store rename');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toMatch(/src\/book-store\.js \(moved to src\/store\.js/);
    await until('the store card follows the revert', async () => (await artifactsOf(STORE)).join() === 'src/store.js');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    expect(graphIssues(env, WS)).toEqual([]);
    expect((await api.metrics(WS)).understanding.consistency.value).toBe(1);
  });
});
