import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entitiesOf, refs, runNode, testsPass } from '../support/landed.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const BUG = 'Product/Bug/empty-title-accepted';
const DUPLICATE = 'Product/Bug/blank-titles-allowed';
const REGRESSION = 'Harness/Issue/listing-ignores-limit';
const kg = (p: string) => `knowledge-graph/${p}.md`;
const FIX = "if (typeof input.title !== 'string' || !input.title.trim() || typeof input.author !== 'string') {";
const LIMIT_TEST = `import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

let server;
let base;
before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  base = \`http://localhost:\${server.address().port}\`;
});
after(() => server.close());

test('GET /books?limit=2 answers two books', async () => {
  const books = await (await fetch(\`\${base}/books?limit=2\`)).json();
  assert.equal(books.length, 2);
});
`;
/** What GET answers for a path, from the server on the main line */
const answer = (path: string) => `import { createApp } from './src/server.js';
const server = createApp().listen(0, async () => {
  const res = await fetch('http://localhost:' + server.address().port + ${JSON.stringify(path)});
  console.log(JSON.stringify({ status: res.status, body: await res.text() }));
  server.close();
});`;

const bug = (title: string, card: string) =>
  entityText({ type: 'Product/Bug', origin: 'requested', title, card, impact: [3, 3, 1], references: [{ to: API, relation: 'concerns' }], extra: { severity: 'medium' } });

// Implementation runs on approved bugs; validation runs on landed work, and every night once the user schedules it
scenario('bug-lifecycle', { enabled: [WS], triggers: ['implementation'] }, async ({ env, api, app, model, step }) => {
  const bugs = async () => (await api.metrics(WS)).implementation.bugs.value;
  const validationTrigger = kg('Harness/Trigger/validation');
  const get = (path: string) => JSON.parse(runNode(env, WS, answer(path)).trim()) as { status: number; body: string };
  /** What the scenario found the runs wrote, whatever they named it */
  let filed = '';

  model.on('the chat files a bug', (t) => t.automation === 'chat' && t.kind === 'prompt' && /empty title/i.test(t.input), (t) => [
    move.write(t, kg(BUG), bug('An empty title is accepted', '`POST /books` with `"title": ""` answers 201 and stores a book without a title; it should answer 400.')),
    move.say('Filed the bug.'),
  ]);
  model.on('implementation fixes it', { automation: 'implementation', kind: 'prompt' }, (t) =>
    t.target === BUG
      ? [
          move.write(t, 'src/server.js', readFileSync(t.file('src/server.js'), 'utf8').replace("if (typeof input.title !== 'string' || typeof input.author !== 'string') {", FIX)),
          move.say('Empty titles answer 400 now; the existing validation test covers it.'),
        ]
      : [move.say('Done.')],
  );
  model.on('implementation summarizes', { automation: 'implementation', kind: 'summarize' }, (t) => [
    move.summarize(),
    move.write(
      t,
      kg(API),
      readFileSync(t.file(kg(API)), 'utf8')
        .replace('verification: verified', 'verification: unverified')
        .replace('An empty title still passes the check.', 'An empty title is refused with 400.')
        .replace('    relation: implements\n', `    relation: implements\n  - to: ${BUG}\n    relation: implements\n`),
    ),
    move.say('Summarized.'),
  ]);
  // Validation after the fix finds nothing; the nightly run after the user's change finds a regression
  let nightly = false;
  model.on('validation', { automation: 'validation', kind: 'prompt' }, (t) =>
    nightly
      ? [
          move.entity(t, REGRESSION, {
            type: 'Harness/Issue',
            title: 'Listing ignores the limit',
            card: '`GET /books?limit=2` answers every book since the last commit to `src/server.js`.',
            impact: [3, 3, 2],
            references: [{ to: API, relation: 'concerns' }],
            extra: {
              source: 'validation',
              category: 'regression',
              severity: 'high',
              options: [
                { label: 'Fix the code', change: 'Apply the limit to the listing again.' },
                { label: 'Drop the limit', change: 'Remove the limit from the card and the tests.' },
              ],
              recommended: 0,
            },
          }),
          move.say('One regression.'),
        ]
      : [move.say('Every test passes; nothing to raise.')],
  );

  await step(0, async () => {
    // Validation, for landed work only until the user schedules it
    env.commit(WS, { [validationTrigger]: env.show(WS, validationTrigger)!.replace(/^schedule: .*\r?\n/m, '') }, 'Validate landed work');
    await app.approve(WS, 'Harness/Trigger/validation');
    expect(await bugs()).toBe(0);
    const chat = await app.chat(WS, 'I could save a book with an empty title. File it as a bug.');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    const written = (await entitiesOf(env, WS, chat)).filter((p) => p.startsWith('Product/Bug/'));
    expect(written, 'the bug the chat filed').toHaveLength(1);
    filed = written[0]!;
    const item = await until('the bug in the feed', async () => (await api.feed()).items.find((i) => i.path === filed));
    expect(item.type).toBe('Product/Bug');
    await until('the bug counted open', async () => (await bugs()) === 1);
  });

  await step(1, async () => {
    const since = new Date();
    await app.approve(WS, filed);
    const impl = await api.automationRan(WS, 'implementation', since, 30 * 60_000);
    expect(impl.status).toBe('finished');
    expect(impl.target_path).toBe(filed);
    // Fixed: an empty title answers 400, and the suite, its validation test included, passes
    expect(testsPass(env, WS)).toBe(true);
    const validation = await api.automationRan(WS, 'validation', new Date(impl.ended_at!), 30 * 60_000);
    expect(validation.trigger).toBe('event');
    expect(validation.status).toBe('finished');
    expect((await entitiesOf(env, WS, validation.id)).filter((p) => p.startsWith('Harness/Issue/'))).toEqual([]);
    // Still open until the fix is approved
    expect(await bugs()).toBe(1);
    const results = (await Promise.all((await entitiesOf(env, WS, impl.id)).map((p) => api.entity(WS, p)))).filter((e) => refs(e, 'implements').includes(filed));
    expect(results.length, 'an entity implementing the bug').toBeGreaterThan(0);
    for (const r of results) await app.approve(WS, r.path);
    // The card leaves the feed as the approval is indexed; the bug is back in sync once the approval is through
    await until('the bug back in sync', async () => (await api.entity(WS, filed)).sync === 'synced', 30_000, 500);
    await until('the bug counted fixed', async () => (await bugs()) === 0);
  });

  // Nothing points at the duplicate: the chat removes it, and the harness reports what went
  model.on('a duplicate removed', (t) => t.automation === 'chat' && t.target === DUPLICATE && t.kind === 'prompt', (t) => [
    move.remove(t, kg(DUPLICATE)),
    move.say(`It duplicates ${BUG}, fixed already; removed it.`),
  ]);

  await step(2, async () => {
    env.commit(WS, { [kg(DUPLICATE)]: bug('Blank titles allowed', 'A book can be saved with a blank title.') }, 'Report blank titles');
    await until('the duplicate in the feed', async () => (await api.feed()).items.some((i) => i.path === DUPLICATE));
    const chat = await app.sendBack(WS, DUPLICATE, `Duplicate of ${filed}, which is fixed. Remove it.`);
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // The chat removed it itself; its timeline event says what went, with the title it had
    expect(env.show(WS, kg(DUPLICATE))).toBeNull();
    const event = await until('the chat on the timeline', async () => (await api.timeline({ workspace: WS })).events.find((e) => e.runId === chat));
    expect(event.facts.removed).toEqual([{ path: DUPLICATE, title: 'Blank titles allowed' }]);
    await until('no bug counted open', async () => (await bugs()) === 0);
  });

  model.on('the chat fixes the regression', (t) => t.automation === 'chat' && t.target === REGRESSION && t.kind === 'prompt', (t) => [
    move.write(t, 'src/server.js', readFileSync(t.file('src/server.js'), 'utf8').replace('store.all().slice(0)', 'store.all().slice(0, limit)')),
    move.remove(t, kg(REGRESSION)),
    move.say('The limit applies again; the regression is retired.'),
  ]);

  await step(3, async () => {
    // The user adds a limit to the listing with its test, then breaks it in a later commit
    const listing = env.show(WS, 'src/server.js')!.match(/^.*pathname === '\/books'\) return send\(res, 200, store\.all\(\)\);$/m)?.[0];
    expect(listing, 'the listing route on the main line').toBeTruthy();
    env.commit(
      WS,
      {
        'src/server.js': env
          .show(WS, 'src/server.js')!
          .replace(listing!, `    const limit = Number(new URL(req.url, 'http://localhost').searchParams.get('limit') ?? Infinity);\n${listing!.replace('store.all())', 'store.all().slice(0, limit))')}`),
        'test/limit.test.js': LIMIT_TEST,
      },
      'Limit the listing',
    );
    expect(testsPass(env, WS)).toBe(true);
    env.commit(WS, { 'src/server.js': env.show(WS, 'src/server.js')!.replace('store.all().slice(0, limit)', 'store.all().slice(0)') }, 'Tidy the listing');
    expect(testsPass(env, WS)).toBe(false);
    nightly = true;
    const defects = (await api.metrics(WS)).implementation.defects.value ?? 0;
    const since = new Date();
    // The night comes: validation runs on its schedule
    env.commit(WS, { [validationTrigger]: env.show(WS, validationTrigger)!.replace(/^(on_demand: .*)$/m, '$1\nschedule: "* * * * *"') }, 'Validate every minute');
    const run = await api.automationRan(WS, 'validation', since, 30 * 60_000);
    expect(run.trigger).toBe('schedule');
    nightly = false;
    env.commit(WS, { [validationTrigger]: env.show(WS, validationTrigger)!.replace(/^schedule: .*$/m, 'schedule: "0 2 * * *"') }, 'Validate nightly');
    // It raised the broken limit, severe, with a way to fix it
    const raised = (await entitiesOf(env, WS, run.id)).filter((p) => p.startsWith('Harness/Issue/'));
    const about = await Promise.all(raised.map(async (p) => (/limit/i.test((await api.entity(WS, p)).markdown) ? p : null)));
    const issues = (await api.feed()).items.filter((i) => about.includes(i.path));
    expect(issues.length, `the broken limit among ${raised.join(', ')}`).toBeGreaterThan(0);
    const issue = issues[0]!;
    expect(issue.issue!.severity).toBe('high');
    expect(issue.issue!.recommended).not.toBeNull();
    await until('the defect counted', async () => ((await api.metrics(WS)).implementation.defects.value ?? 0) > defects);
    // Picking the recommended option repairs it
    const chat = await app.resolve(WS, issue.path, issue.issue!.recommended!);
    expect((await api.runEnded(chat, 15 * 60_000)).status).toBe('finished');
    expect(env.show(WS, kg(issue.path))).toBeNull();
    expect(testsPass(env, WS)).toBe(true);
    const listed = get('/books?limit=2');
    expect(listed.status).toBe(200);
    expect(JSON.parse(listed.body)).toHaveLength(2);
    await until('the defect gone', async () => ((await api.metrics(WS)).implementation.defects.value ?? 0) === defects);
  });

  model.on('a hotfix on demand', (t) => t.automation === 'implementation' && t.trigger === 'on_demand', (t) => [
    move.write(t, 'src/server.js', readFileSync(t.file('src/server.js'), 'utf8').replace("send(res, 404, { error: 'not found' });", "send(res, 404, { error: 'not found', path: pathname });")),
    move.say('Hotfixed.'),
  ]);
  // The API never answers the check: it stays running whatever it would do, a hang injected live too
  model.on('a slow consistency check', { automation: 'consistency-check', kind: 'prompt' }, () => [move.hang()]);

  await step(4, async () => {
    await api.approve(WS, 'Harness/Trigger/consistency-check');
    const check = await until('the consistency check running', async () => (await api.runs(WS, 'consistency-check')).find((r) => r.status === 'running'), 60_000);
    // Production is down: the user starts a fix at once, beside the automation run
    const { runId } = await api.runAutomation(WS, 'implementation', 'Hotfix: 404 answers must say which path was not found.');
    const hotfix = await api.runEnded(runId, 20 * 60_000);
    expect(hotfix.status).toBe('finished');
    expect((await api.run(check.id)).status).toBe('running');
    // A 404 now names the path
    const missing = get('/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toContain('/nope');
    await api.mcp('kill_run', { id: check.id });
  });
});
