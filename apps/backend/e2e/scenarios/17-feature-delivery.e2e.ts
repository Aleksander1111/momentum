import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MetricsResponse, TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { REPO } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, entitiesOf, filesOf, refs, testsPass } from '../support/landed.ts';
import { entityText, messageFileOf, move, type Move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const GOAL = 'Product/Goal/find-books-fast';
const RELIABLE = 'Product/Goal/reliable-api';
const API = 'Architecture/Api/books-api';
// What the scripted model writes; the real model names its own, found from what its runs landed
const RESEARCH = 'Harness/Research/searching-books-by-author';
const FEATURE = 'Product/Feature/search-by-author';
const PLAN = 'Harness/Plan/search-by-author';
const DEFECT = 'Harness/Issue/lookup-by-id-broken';
const PLAN_FILE = 'plans/search-by-author.md';
/** What the user says to resolve the defect, in their own words */
const RESOLUTION = 'Fix the code so the whole test suite passes again.';

const LOOKUP = 'return list.find((book) => book.id === id);';
const BROKEN_LOOKUP = 'return list[id];';

const ROUTE = `
// GET /books?author=<name>: the books by that author
export function byAuthor(books, author) {
  return books.filter((b) => b.author === author);
}
`;
const apiCard = (extra: string) => `JSON over \`node:http\`; \`createApp(store)\` builds the server, so tests start it on a free port with a fresh store.

| Method | Path | Answer |
| --- | --- | --- |
| GET | \`/books\` | 200 with every book; \`?author=\` keeps that author's books |
| GET | \`/books/:id\` | 200 with the book, 404 when missing |
| POST | \`/books\` | 201 with the new book; 400 when the body is not JSON or the title or author is missing or empty |

${extra}`;
const apiEntity = (extra: string) =>
  entityText({
    type: 'Architecture/Api',
    origin: 'user',
    title: 'Books API',
    card: apiCard(extra),
    impact: [3, 1, 2],
    references: [
      { to: 'Architecture/Component/book-store', relation: 'depends_on' },
      { to: 'Product/Product/bookshelf', relation: 'part_of' },
      { to: 'Governance/DesignDoc/design', relation: 'implements' },
      { to: PLAN, relation: 'implements' },
    ],
    artifacts: ['src/server.js'],
  });

// The user switches the triggers on one by one as the work gets there
scenario('feature-delivery', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  model.on('exploration proposes', { automation: 'exploration', kind: 'prompt' }, (t) => [
    move.parallel({ tool: 'mcp__momentum-kb__search', input: { query: 'find books' } }, { tool: 'Glob', input: { pattern: 'src/**/*.js' } }),
    move.entity(t, RESEARCH, {
      type: 'Harness/Research',
      title: 'Searching books by author',
      card: 'Readers know the author more often than the title. A query parameter on the listing finds them in one request.',
      references: [{ to: GOAL, relation: 'informs' }],
    }),
    move.entity(t, FEATURE, {
      type: 'Product/Feature',
      title: 'Search books by author',
      card: '`GET /books?author=<name>` answers with the books by that author, so a reader finds a book in one request.',
      impact: [4, 2, 3],
      references: [
        { to: GOAL, relation: 'advances' },
        { to: RESEARCH, relation: 'based_on' },
      ],
    }),
    move.say('Proposed searching by author.'),
  ]);

  const { exploration, action } = await step(0, async () => {
    // The user fixes the empty title first: the API goal is met, finding books fast is the one goal left
    const server = env.show(WS, 'src/server.js')!;
    const goal = env.show(WS, `knowledge-graph/${RELIABLE}.md`)!;
    const card = env.show(WS, `knowledge-graph/${API}.md`)!;
    env.commit(
      WS,
      {
        'src/server.js': server.replace(
          "typeof input.title !== 'string' || typeof input.author !== 'string'",
          "typeof input.title !== 'string' || !input.title.trim() || typeof input.author !== 'string' || !input.author.trim()",
        ),
        [`knowledge-graph/${API}.md`]: card
          .replace('the title or author is not a string', 'the title or author is missing or empty')
          .replace(/\r?\nAn empty title still passes the check\.\r?\n?/, '\n'),
        [`knowledge-graph/${RELIABLE}.md`]: goal.replace(/- \*\*Not met yet:\*\*.*/, '- **Met:** an empty title or author answers 400; the validation test passes'),
      },
      'Refuse empty titles and authors',
    );
    expect(testsPass(env, WS)).toBe(true);
    const since = new Date();
    // In effect as it lands: the user has not reviewed it
    await env.trigger(WS, 'exploration', {}, false);
    const run = await api.automationRan(WS, 'exploration', since, 10 * 60_000);
    expect(run.trigger).toBe('schedule');
    expect((await api.entity(WS, 'Harness/Trigger/exploration')).verification).toBe('unverified');
    expect(run.status).toBe('finished');
    // It was told the date, as every automation is
    expect(model.turns(run.id)[0]!.input).toMatch(/Today is \d{4}-\d{2}-\d{2}\./);
    // Research, and an action advancing the open goal based on it, both waiting in the feed
    const written = await entitiesOf(env, WS, run.id);
    const details = await Promise.all(written.map((p) => api.entity(WS, p)));
    const research = details.find((e) => e.type === 'Harness/Research');
    expect(research, `research among ${written.join(', ')}`).toBeTruthy();
    const proposed = details.find((e) => e.type.startsWith('Product/') && refs(e, 'advances').includes(GOAL));
    expect(proposed, `an action advancing ${GOAL} among ${written.join(', ')}`).toBeTruthy();
    expect(proposed!.type).toMatch(/^Product\/(Feature|FeatureRequest|UserStory|DevTask)$/);
    expect(refs(proposed!, 'based_on')).toContain(research!.path);
    const feed = (await api.feed()).items.map((i) => i.path);
    expect(feed).toEqual(expect.arrayContaining([research!.path, proposed!.path]));
    // The timeline names the run by the subject it landed under
    const [commit] = await commitsOf(env, WS, run.id);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=automation`);
    expect(events.find((e) => e.runId === run.id && e.kind === 'run_finished')?.title).toBe(env.git(WS, 'log', '-1', '--format=%s', commit!));
    // Once per due time: the schedule does not start it again
    await new Promise((r) => setTimeout(r, 8000));
    expect(await api.runs(WS, 'exploration')).toHaveLength(1);
    return { exploration: run, action: proposed!.path };
  });

  model.on('preparation plans', { automation: 'preparation', kind: 'prompt' }, (t) => [
    move.parallel({ tool: 'mcp__momentum-kb__search', input: { query: 'search by author' } }, { tool: 'Grep', input: { pattern: 'author', path: 'src' } }),
    move.write(t, PLAN_FILE, `# Search by author\n\nPlans ${FEATURE}.\n\n1. Read \`author\` from the query string in \`GET /books\`.\n2. Filter the store.\n3. Test it.\n`),
    move.say('Planned.'),
  ]);
  model.on('preparation summarizes its plan', { automation: 'preparation', kind: 'summarize' }, (t) => [
    move.summarize(),
    move.entity(t, PLAN, {
      type: 'Harness/Plan',
      title: 'Plan: search by author',
      card: 'Read `author` from the query string of `GET /books`, filter the store by it and cover it with a test.',
      impact: [3, 2, 3],
      references: [{ to: FEATURE, relation: 'plans' }],
      artifacts: [PLAN_FILE],
    }),
    move.say('Summarized.'),
  ]);

  const plan = await step(1, async () => {
    await app.approve(WS, action);
    expect((await api.entity(WS, action)).sync).toBe('entity_ahead');
    // The implementation trigger is switched off: nothing implements the action yet
    await new Promise((r) => setTimeout(r, 8000));
    expect(await api.runs(WS, 'implementation')).toEqual([]);
    const since = new Date();
    await env.trigger(WS, 'preparation');
    const run = await api.automationRan(WS, 'preparation', since, 15 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.trigger).toBe('schedule');
    // Never alongside another automation run of the project
    expect(+run.started_at!).toBeGreaterThanOrEqual(+exploration.ended_at!);
    // Its plan file, summarized into a Harness/Plan of the action, waits in the feed
    const plans = (await Promise.all((await entitiesOf(env, WS, run.id)).map((p) => api.entity(WS, p)))).filter(
      (e) => e.type === 'Harness/Plan' && refs(e, 'plans').includes(action),
    );
    expect(plans).toHaveLength(1);
    const files = plans[0]!.artifacts.map((a) => a.path);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^plans\/.+\.md$/);
    expect(env.show(WS, files[0]!)).toContain(action);
    expect((await api.feed()).items.map((i) => i.path)).toContain(plans[0]!.path);
    // An automation run's retrieval is rated like a chat's, against the task it was given
    const rated = await until('the preparation retrieval rated', async () => (await api.run(run.id)).turns.find((t) => t.retrievalState === 'rated') ?? null, 2 * 60_000);
    expect(rated.retrieval!.tools.map((t) => t.tool)).toEqual(['momentum-kb · search', 'Grep']);
    expect(rated.retrieval!.parallel).toBe(true);
    const metrics = await api.call<MetricsResponse>('GET', `/workspaces/${WS}/metrics?range=24h`);
    expect(metrics.retrieval.automations.map((a) => a.automation)).toEqual(expect.arrayContaining(['exploration', 'preparation']));
    await app.tab('Metrics');
    await expect(app.text('By automation')).toBeVisible({ timeout: 30_000 });
    await expect(app.text('Preparation', false).last()).toBeVisible();
    const panel = app.frame().getByText('Retrieval', { exact: true }).last().locator('..');
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: join(REPO, 'test-results', 'retrieval-by-automation.png') });
    return plans[0]!.path;
  });

  model.on('implementation codes', { automation: 'implementation', kind: 'prompt' }, (t) => [
    move.write(t, 'src/search.js', ROUTE),
    move.write(t, 'test/search.test.js', "import { test } from 'node:test';\n\ntest('search by author', () => {});\n"),
    move.say('Implemented search by author.'),
  ]);
  // Summarization, the sub-agent's work: the API card follows the code and implements the plan
  model.on('implementation summarizes', { automation: 'implementation', kind: 'summarize' }, (t) => [
    move.summarize(),
    move.write(t, `knowledge-graph/${API}.md`, apiEntity('An empty title is refused with 400.')),
    move.say('Summarized.'),
  ]);
  // The implementation lands only once the user has pushed a change of their own: its landing goes on top of it
  let regress!: () => void;
  const regressed = new Promise<void>((r) => (regress = r));
  model.on('lands after the user', { automation: 'implementation', kind: 'commit-message' }, (t) => {
    const file = messageFileOf(t.input);
    const message: Move[] = file ? [{ tool: 'Write', input: { file_path: file, content: 'Search books by author\n' } }, move.say('Described.')] : [move.say('Done.')];
    return [move.gate(regressed), ...message];
  });

  model.on('validation finds a defect', { automation: 'validation', kind: 'prompt' }, (t) => [
    move.entity(t, DEFECT, {
      type: 'Harness/Issue',
      title: 'Looking a book up by id answers the wrong book',
      card: '`GET /books/2` answers "Clean Code" instead of "Refactoring": `get(id)` reads the list by position. `npm test` fails.',
      impact: [3, 3, 2],
      references: [{ to: 'Architecture/Component/book-store', relation: 'concerns' }],
      extra: {
        source: 'validation',
        category: 'defect',
        severity: 'high',
        options: [
          { label: 'Find by id', change: 'Look the book up by its id again.' },
          { label: 'Shift the index', change: 'Read the list at id - 1.' },
        ],
        recommended: 0,
      },
    }),
    move.say('One defect raised.'),
  ]);
  model.on('the chat applies the resolution', (t) => t.automation === 'chat' && t.target === DEFECT && t.kind === 'prompt', (t) => [
    move.write(t, 'src/store.js', env.show(WS, 'src/store.js')!.replace(BROKEN_LOOKUP, LOOKUP)),
    move.remove(t, `knowledge-graph/${DEFECT}.md`),
    move.say('Lookups find the book by its id again; the issue is retired.'),
  ]);

  const implemented = await step(2, async () => {
    // The validation trigger runs on landed work here, not on its nightly schedule
    await env.trigger(WS, 'validation', { schedule: null });
    await env.trigger(WS, 'implementation');
    const before = env.head(WS);
    const since = new Date();
    await app.approve(WS, plan);
    const started = await until('the implementation run', async () => (await api.runs(WS, 'implementation')).find((r) => r.created_at >= since), 60_000);
    // While it describes its work, the user commits a change of their own that breaks looking a book up
    await until('the implementation to describe its work', async () => model.turns(started.id).some((t) => t.kind === 'commit-message'), 20 * 60_000);
    env.commit(WS, { 'src/store.js': env.show(WS, 'src/store.js')!.replace(LOOKUP, BROKEN_LOOKUP) }, 'Look books up by position');
    regress();
    const run = await api.runEnded(started.id, 10 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.trigger).toBe('event');
    expect(run.targetPath).toBe(plan);
    // It landed on top of the user's change, which it kept
    expect(env.show(WS, 'src/store.js')).toContain(BROKEN_LOOKUP);
    // One commit with code, tests and the knowledge base, under the subject the run wrote
    const own = await commitsOf(env, WS, run.id);
    expect(own).toHaveLength(1);
    expect(env.git(WS, 'log', '--format=%H', `${before}..main`).split('\n')).toContain(own[0]);
    const files = filesOf(env, WS, own);
    expect(files.some((f) => f.startsWith('src/'))).toBe(true);
    expect(files.some((f) => f.startsWith('test/'))).toBe(true);
    expect(files.some((f) => f.startsWith('knowledge-graph/'))).toBe(true);
    // Its own summarization covered its code: the only summarization that follows is the one of the user's change
    await new Promise((r) => setTimeout(r, 6000));
    // (every entity over src/store.js, whichever the runs before named)
    const summarizing = await env.sql<{ prompt: string }[]>`select prompt from ${env.sql('ws_bookshelf_api.run')} where automation = 'summarization'`;
    const listed = summarizing.flatMap((r) => [...r.prompt.matchAll(/^- [^:\n]+: (.+)$/gm)].flatMap((m) => m[1]!.split(', ')));
    expect(listed.filter((a) => !a.startsWith('src/store.js'))).toEqual([]);
    expect(summarizing.filter((r) => r.prompt.includes('were added on the main line'))).toEqual([]);
    // Approving the result brings the plan, and the action it plans, back in sync
    // Updating while validation runs over it; then waiting for its implementation to be approved
    await until('the plan ahead of its implementation', async () => (await api.entity(WS, plan)).sync === 'entity_ahead', 20 * 60_000, 5000);
    const results = (await Promise.all((await entitiesOf(env, WS, run.id)).map((p) => api.entity(WS, p)))).filter((e) => refs(e, 'implements').includes(plan));
    expect(results.length, 'an entity implementing the plan').toBeGreaterThan(0);
    for (const r of results) await app.approve(WS, r.path);
    // Back in sync once the approval is through, a moment after its card left the feed
    await until('the plan back in sync', async () => (await api.entity(WS, plan)).sync === 'synced', 30_000, 500);
    await until('the action back in sync', async () => (await api.entity(WS, action)).sync === 'synced', 30_000, 500);
    return run;
  });

  await step(3, async () => {
    const run = await api.automationRan(WS, 'validation', new Date(implemented.endedAt!), 15 * 60_000);
    expect(run.trigger).toBe('event');
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toContain(plan);
    // The broken lookup is raised as a defect, with ways to resolve it
    const raised = (await entitiesOf(env, WS, run.id)).filter((p) => p.startsWith('Harness/Issue/'));
    expect(raised.length, 'a defect raised').toBeGreaterThan(0);
    const feed = (await api.feed()).items.filter((i) => raised.includes(i.path));
    expect(feed).toHaveLength(raised.length);
    const sources = Object.fromEntries((await api.entities(WS, 'Harness/Issue')).map((e) => [e.path, e.frontmatter.source]));
    for (const item of feed) {
      expect(item.issue!.options.length).toBeGreaterThanOrEqual(2);
      expect(item.issue!.concerns.length).toBeGreaterThan(0);
      expect(sources[item.path]).toBe('validation');
    }
    await until('the defects counted', async () => (await api.metrics(WS)).implementation.defects.value === raised.length);

    for (const issue of raised) {
      const chat = await app.ownResolution(WS, issue, RESOLUTION);
      expect((await api.run(chat)).messages[0]!.text).toBe(RESOLUTION);
      expect((await api.runEnded(chat, 15 * 60_000)).status).toBe('finished');
      expect(env.show(WS, `knowledge-graph/${issue}.md`)).toBeNull();
    }
    // The fix landed: looking a book up works again and the suite passes
    expect(env.show(WS, 'src/store.js')).not.toContain(BROKEN_LOOKUP);
    expect(testsPass(env, WS)).toBe(true);
    await until('no defect left', async () => (await api.metrics(WS)).implementation.defects.value === 0);
  });

  await step(4, async () => {
    const runs = (await api.runs(WS)).filter((r) => r.automation !== 'chat' && r.started_at).sort((a, b) => +a.started_at! - +b.started_at!);
    // Each automation in its turn, and never two of the project's automation runs at once
    // in the order the work went; a schedule falling due on the real clock while the scenario runs may add a run of its own
    const work = runs.filter((r) => r.automation !== 'summarization');
    expect([...new Set(work.map((r) => r.automation))]).toEqual(['exploration', 'preparation', 'implementation', 'validation']);
    for (const [i, r] of work.entries()) if (work.findIndex((x) => x.automation === r.automation) < i) expect(r.trigger).toBe('schedule');
    for (let i = 1; i < runs.length; i++) expect(+runs[i]!.started_at!).toBeGreaterThanOrEqual(+runs[i - 1]!.ended_at!);
    const checkouts = join(env.dir, 'runs', WS);
    expect(existsSync(checkouts) ? readdirSync(checkouts) : []).toEqual([]);
    expect(env.git(WS, 'worktree', 'list').split('\n')).toHaveLength(1);
  });
});
