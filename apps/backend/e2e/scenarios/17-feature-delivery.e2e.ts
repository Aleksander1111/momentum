import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const GOAL = 'Product/Goal/find-books-fast';
const API = 'Architecture/Api/books-api';
const RESEARCH = 'Harness/Research/searching-books-by-author';
const FEATURE = 'Product/Feature/search-by-author';
const PLAN = 'Harness/Plan/search-by-author';
const DEFECT = 'Harness/Issue/search-ignores-case';
const PLAN_FILE = 'plans/search-by-author.md';

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
| POST | \`/books\` | 201 with the new book; 400 when the body is not JSON or the title or author is not a string |

${extra}`;
const apiEntity = (extra: string, implementsPlan: boolean) =>
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
      ...(implementsPlan ? [{ to: PLAN, relation: 'implements' }, { to: FEATURE, relation: 'implements' }] : []),
    ],
    artifacts: ['src/server.js'],
  });

// The triggers of exploration and preparation are approved: their schedules are due at once
scenario('feature-delivery', { enabled: [WS], triggers: ['exploration'] }, async ({ env, api, app, model, step }) => {
  model.on('exploration proposes', { automation: 'exploration', kind: 'prompt' }, (t) => [
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

  const exploration = await step(0, async () => {
    const run = await api.automationRan(WS, 'exploration', new Date(0), 5 * 60_000);
    expect(run.trigger).toBe('schedule');
    expect(run.status).toBe('finished');
    // It was told the date, as every automation is
    expect(model.turns(run.id)[0]!.input).toMatch(/Today is \d{4}-\d{2}-\d{2}\./);
    const feed = (await api.feed()).items.map((i) => i.path);
    expect(feed).toEqual(expect.arrayContaining([RESEARCH, FEATURE]));
    expect(await api.referencing(WS, GOAL)).toEqual(expect.arrayContaining([FEATURE]));
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=automation`);
    expect(events.find((e) => e.runId === run.id && e.kind === 'run_finished')?.title).toContain('Scripted exploration work');
    // Once per due time: the schedule does not start it again
    await new Promise((r) => setTimeout(r, 8000));
    expect(await api.runs(WS, 'exploration')).toHaveLength(1);
    return run;
  });

  model.on('preparation plans', { automation: 'preparation', kind: 'prompt' }, (t) => [
    move.write(t, PLAN_FILE, '# Search by author\n\n1. Read `author` from the query string in `GET /books`.\n2. Filter the store.\n3. Test it.\n'),
    move.say('Planned.'),
  ]);
  model.on('preparation summarizes its plan', { automation: 'preparation', kind: 'summarize' }, (t) => [
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

  await step(1, async () => {
    await app.approve(WS, FEATURE);
    expect((await api.entity(WS, FEATURE)).sync).toBe('entity_ahead');
    // The implementation trigger waits unverified in the feed: nothing implements the feature yet
    await new Promise((r) => setTimeout(r, 8000));
    expect(await api.runs(WS, 'implementation')).toEqual([]);
    const since = new Date();
    await app.approve(WS, 'Harness/Trigger/preparation');
    const run = await api.automationRan(WS, 'preparation', since, 5 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.trigger).toBe('schedule');
    // Never alongside another automation run of the project
    expect(+run.started_at!).toBeGreaterThanOrEqual(+exploration.ended_at!);
    const plan = await api.entity(WS, PLAN);
    expect(plan.artifacts.map((a) => a.path)).toEqual([PLAN_FILE]);
    expect(env.show(WS, PLAN_FILE)).toContain('Search by author');
    expect((await api.feed()).items.map((i) => i.path)).toContain(PLAN);
  });

  model.on('implementation codes', { automation: 'implementation', kind: 'prompt' }, (t) => [
    move.write(t, 'src/search.js', ROUTE),
    move.write(t, 'test/search.test.js', "import { test } from 'node:test';\n\ntest('search by author', () => {});\n"),
    move.say('Implemented search by author.'),
  ]);
  // Summarization, the sub-agent's work: the API card follows the code and implements the plan
  model.on('implementation summarizes', { automation: 'implementation', kind: 'summarize' }, (t) => [
    move.write(t, `knowledge-graph/${API}.md`, apiEntity('An empty title still passes the check.', true)),
    move.say('Summarized.'),
  ]);
  model.subject = (t) => (t.automation === 'implementation' ? 'Search books by author' : `Scripted ${t.automation} work`);

  model.on('validation finds a defect', { automation: 'validation', kind: 'prompt' }, (t) => [
    move.entity(t, DEFECT, {
      type: 'Harness/Issue',
      title: 'Search by author ignores letter case',
      card: '`GET /books?author=le guin` finds nothing while "Le Guin" has books: the comparison is case-sensitive.',
      impact: [3, 3, 2],
      references: [{ to: API, relation: 'concerns' }],
      extra: {
        source: 'validation',
        category: 'defect',
        severity: 'medium',
        options: [
          { label: 'Ignore case', change: 'Compare authors in lower case.' },
          { label: 'Document it', change: 'Say on the card that the search is case-sensitive.' },
        ],
        recommended: 0,
      },
    }),
    move.say('One defect raised.'),
  ]);
  model.on('the chat applies the resolution', (t) => t.automation === 'chat' && t.target === DEFECT && t.kind === 'prompt', (t) => [
    move.write(t, 'src/search.js', ROUTE.replace('b.author === author', 'b.author.toLowerCase() === author.toLowerCase()')),
    move.remove(t, `knowledge-graph/${DEFECT}.md`),
    move.say('Search ignores case now; the issue is retired.'),
  ]);
  model.on('the chat summarizes the fix', (t) => t.automation === 'chat' && t.target === DEFECT && t.kind === 'summarize', (t) => [
    move.write(t, `knowledge-graph/${API}.md`, apiEntity('Searching by author ignores letter case. An empty title still passes the check.', true)),
    move.say('Summarized.'),
  ]);

  const implemented = await step(2, async () => {
    // The validation trigger runs on landed work here, not on its nightly schedule
    const file = 'knowledge-graph/Harness/Trigger/validation.md';
    env.commit(WS, { [file]: env.show(WS, file)!.replace(/^schedule: .*\r?\n/m, '') }, 'Validate landed work only');
    await app.approve(WS, 'Harness/Trigger/validation');
    await app.approve(WS, 'Harness/Trigger/implementation');
    const before = env.head(WS);
    const since = new Date();
    await app.approve(WS, PLAN);
    const run = await api.automationRan(WS, 'implementation', since, 5 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.trigger).toBe('event');
    expect(run.target_path).toBe(PLAN);
    // One commit with the code, the test and the card, under the subject the run wrote
    const commits = env.git(WS, 'log', '--format=%H %s', `${before}..main`).split('\n');
    const own = commits.filter((c) => c.endsWith(' Search books by author'));
    expect(own).toHaveLength(1);
    const files = env.git(WS, 'show', '--name-only', '--format=', own[0]!.split(' ')[0]!).split('\n');
    expect(files).toEqual(expect.arrayContaining(['src/search.js', 'test/search.test.js', `knowledge-graph/${API}.md`]));
    // Its own summarization covered the code: no summarization run follows
    await new Promise((r) => setTimeout(r, 6000));
    expect(await api.runs(WS, 'summarization')).toEqual([]);
    expect((await api.entity(WS, PLAN)).sync).toBe('entity_ahead');
    await app.approve(WS, API);
    expect((await api.entity(WS, PLAN)).sync).toBe('synced');
    expect((await api.entity(WS, FEATURE)).sync).toBe('synced');
    return run;
  });

  await step(3, async () => {
    const run = await api.automationRan(WS, 'validation', new Date(implemented.ended_at!), 5 * 60_000);
    expect(run.trigger).toBe('event');
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toContain(PLAN);
    const item = await until('the defect in the feed', async () => (await api.feed()).items.find((i) => i.path === DEFECT));
    expect(item.issue!.options.map((o) => o.label)).toEqual(['Ignore case', 'Document it']);
    expect(item.issue!.concerns).toEqual([API]);
    expect((await api.metrics(WS)).implementation.defects.value).toBe(1);

    const chat = await app.ownResolution(WS, DEFECT, 'Ignore case, and keep the exact match first.');
    expect((await api.run(chat)).messages[0]!.text).toBe('Ignore case, and keep the exact match first.');
    expect((await api.runEnded(chat, 5 * 60_000)).status).toBe('finished');
    expect(env.show(WS, `knowledge-graph/${DEFECT}.md`)).toBeNull();
    expect(env.show(WS, 'src/search.js')).toContain('toLowerCase()');
    expect((await api.entity(WS, API)).markdown).toContain('ignores letter case');
    await until('no defect left', async () => (await api.metrics(WS)).implementation.defects.value === 0);
  });

  await step(4, async () => {
    const runs = (await api.runs(WS)).filter((r) => r.trigger !== 'on_demand' && r.started_at).sort((a, b) => +a.started_at! - +b.started_at!);
    expect(runs.map((r) => r.automation)).toEqual(['exploration', 'preparation', 'implementation', 'validation']);
    for (let i = 1; i < runs.length; i++) expect(+runs[i]!.started_at!).toBeGreaterThanOrEqual(+runs[i - 1]!.ended_at!);
    const checkouts = join(env.dir, 'runs', WS);
    expect(existsSync(checkouts) ? readdirSync(checkouts) : []).toEqual([]);
    expect(env.git(WS, 'worktree', 'list').split('\n')).toHaveLength(1);
  });
});
