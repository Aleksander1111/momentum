import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const BUG = 'Product/Bug/empty-title-accepted';
const DUPLICATE = 'Product/Bug/blank-titles-allowed';
const RETIRE = 'Harness/Plan/retire-duplicate-bug';
const REGRESSION = 'Harness/Issue/listing-ignores-limit';
const kg = (p: string) => `knowledge-graph/${p}.md`;
const FIX = "if (typeof input.title !== 'string' || !input.title.trim() || typeof input.author !== 'string') {";

const bug = (title: string, card: string) =>
  entityText({ type: 'Product/Bug', origin: 'requested', title, card, impact: [3, 3, 1], references: [{ to: API, relation: 'concerns' }], extra: { severity: 'medium' } });

// Implementation runs on approved bugs; validation runs on landed work and every night
scenario('bug-lifecycle', { enabled: [WS], triggers: ['implementation', 'validation'] }, async ({ env, api, app, model, step }) => {
  const bugs = async () => (await api.metrics(WS)).implementation.bugs.value;

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
  // Validation after the fix finds nothing; the nightly run after the developer's change finds a regression
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
    expect(await bugs()).toBe(0);
    const chat = await app.chat(WS, 'A reader says they could save a book with an empty title. File it as a bug.');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    const item = await until('the bug in the feed', async () => (await api.feed()).items.find((i) => i.path === BUG));
    expect(item.type).toBe('Product/Bug');
    expect(await bugs()).toBe(1);
  });

  await step(1, async () => {
    const since = new Date();
    await app.approve(WS, BUG);
    const impl = await api.automationRan(WS, 'implementation', since, 3 * 60_000);
    expect(impl.status).toBe('finished');
    expect(env.show(WS, 'src/server.js')).toContain('!input.title.trim()');
    const validation = await api.automationRan(WS, 'validation', new Date(impl.ended_at!), 3 * 60_000);
    expect(validation.trigger).toBe('event');
    expect(await api.entities(WS, 'Harness/Issue')).toEqual([]);
    // Still open until the fix is approved
    expect(await bugs()).toBe(1);
    await app.approve(WS, API);
    expect((await api.entity(WS, BUG)).sync).toBe('synced');
    await until('the bug counted fixed', async () => (await bugs()) === 0);
  });

  model.on('a duplicate retired', (t) => t.automation === 'chat' && t.target === DUPLICATE && t.kind === 'prompt', (t) => [
    move.entity(t, RETIRE, {
      type: 'Harness/Plan',
      title: 'Retire the duplicate bug',
      card: `The report repeats ${BUG}, fixed already.`,
      impact: [1, 0, 0],
      references: [{ to: DUPLICATE, relation: 'retires' }],
    }),
    move.say('It duplicates the fixed bug; proposed retiring it.'),
  ]);

  await step(2, async () => {
    env.commit(WS, { [kg(DUPLICATE)]: bug('Blank titles allowed', 'A book can be saved with a blank title.') }, 'Report blank titles');
    await until('the duplicate in the feed', async () => (await api.feed()).items.some((i) => i.path === DUPLICATE));
    const chat = await app.sendBack(WS, DUPLICATE, `Duplicate of ${BUG}, which is fixed.`);
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    await app.approve(WS, RETIRE);
    expect(env.show(WS, kg(DUPLICATE))).toBeNull();
    expect(env.show(WS, kg(RETIRE))).toBeNull();
    expect(await bugs()).toBe(0);
  });

  model.on('the chat fixes the regression', (t) => t.automation === 'chat' && t.target === REGRESSION && t.kind === 'prompt', (t) => [
    move.write(t, 'src/server.js', readFileSync(t.file('src/server.js'), 'utf8').replace('store.all().slice(0)', 'store.all().slice(0, limit)')),
    move.remove(t, kg(REGRESSION)),
    move.say('The limit applies again; the regression is retired.'),
  ]);

  await step(3, async () => {
    // A developer adds a limit to the listing, then breaks it in a later commit
    env.commit(
      WS,
      {
        'src/server.js': env
          .show(WS, 'src/server.js')!
          .replace("if (req.method === 'GET' && pathname === '/books') return send(res, 200, store.all());", "const limit = Number(new URL(req.url, 'http://localhost').searchParams.get('limit') ?? Infinity);\n    if (req.method === 'GET' && pathname === '/books') return send(res, 200, store.all().slice(0, limit));"),
      },
      'Limit the listing',
    );
    env.commit(WS, { 'src/server.js': env.show(WS, 'src/server.js')!.replace('store.all().slice(0, limit)', 'store.all().slice(0)') }, 'Tidy the listing');
    nightly = true;
    const since = new Date();
    // The night comes: validation runs on its schedule
    const file = kg('Harness/Trigger/validation');
    env.commit(WS, { [file]: env.show(WS, file)!.replace(/^schedule: .*$/m, 'schedule: "* * * * *"') }, 'Validate every minute');
    const run = await api.automationRan(WS, 'validation', since, 3 * 60_000);
    expect(run.trigger).toBe('schedule');
    const issue = await until('the regression in the feed', async () => (await api.feed()).items.find((i) => i.path === REGRESSION));
    expect(issue.issue!.severity).toBe('high');
    expect((await api.metrics(WS)).implementation.defects.value).toBe(1);
    nightly = false;
    env.commit(WS, { [file]: env.show(WS, file)!.replace(/^schedule: .*$/m, 'schedule: "0 2 * * *"') }, 'Validate nightly again');
    const chat = await app.resolve(WS, REGRESSION, 0);
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'src/server.js')).toContain('store.all().slice(0, limit)');
    await until('no defect left', async () => (await api.metrics(WS)).implementation.defects.value === 0);
  });

  model.on('a hotfix on demand', (t) => t.automation === 'implementation' && t.trigger === 'on_demand', (t) => [
    move.write(t, 'src/server.js', readFileSync(t.file('src/server.js'), 'utf8').replace("send(res, 404, { error: 'not found' });", "send(res, 404, { error: 'not found', path: pathname });")),
    move.say('Hotfixed.'),
  ]);
  model.on('a slow consistency check', { automation: 'consistency-check', kind: 'prompt' }, () => [move.hang()]);

  await step(4, async () => {
    await api.approve(WS, 'Harness/Trigger/consistency-check');
    const check = await until('the consistency check running', async () => (await api.runs(WS, 'consistency-check')).find((r) => r.status === 'running'), 60_000);
    // Production is down: the user starts a fix at once, beside the automation run
    const { runId } = await api.runAutomation(WS, 'implementation', 'Hotfix: 404 answers must say which path was not found.');
    const hotfix = await api.runEnded(runId, 3 * 60_000);
    expect(hotfix.status).toBe('finished');
    expect((await api.run(check.id)).status).toBe('running');
    expect(env.show(WS, 'src/server.js')).toContain('path: pathname');
    await api.mcp('kill_run', { id: check.id });
  });
});
