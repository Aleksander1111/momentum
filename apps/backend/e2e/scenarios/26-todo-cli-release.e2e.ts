import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, entitiesOf, filesOf, refs, testsPass } from '../support/landed.ts';
import { DUE_JS, DUE_TEST, missingArtifacts, PRIORITY_JS, PRIORITY_TEST, TODO_GRAPH } from '../support/life.ts';
import { entityText, move, type Turn } from '../support/scripted.ts';

const WS = 'todo-cli';
const PRIORITY = 'Architecture/Component/priority';
const STORY = 'Product/UserStory/due-dates';
const DUE = 'Architecture/Component/due-dates';
const REPO = 'Code/Repository/todo-cli';
const STORE = 'Architecture/Component/store';
const PRODUCT = 'Product/Product/todo-cli';
const NOTE = 'Knowledge/ReleaseNote/v1-1-0';
const kg = (p: string) => `knowledge-graph/${p}.md`;
/** A slip in the README the user fixes later: the fix changes nothing a card says */
const TYPO = ['No dependencies:', 'No dependancies:'] as const;

/** An entity file of the checkout with a new card, unverified as a run leaves it */
const recard = (t: Turn, path: string, card: string, extra: (text: string) => string = (x) => x) => {
  const text = readFileSync(t.file(kg(path)), 'utf8').replace('verification: verified', 'verification: unverified');
  return extra(text.replace(/(\n# [^\n]+\n)[\s\S]*$/, `$1\n${card}\n`));
};

// The knowledge graph is built and approved; from here on, the user and the harness keep it true day by day
scenario('todo-cli-release', { enabled: [WS], graphBuild: 'complete', triggers: ['implementation'] }, async ({ env, api, app, model, step }) => {
  const summaries = () => api.runs(WS, 'summarization');
  const summarization = (since: Date) => api.automationRan(WS, 'summarization', since, 10 * 60_000);
  /** What the scenario found the runs wrote, whatever they named it */
  let priority = '';
  let story = '';
  let result = '';
  const artifactsOf = async (path: string) => (await api.entity(WS, path)).artifacts.map((a) => a.path);
  const over = async (file: string) =>
    (await env.sql<{ entity_path: string }[]>`select entity_path from ${env.sql('ws_todo_cli.entity_artifact')} where artifact_path = ${file}`).map((r) => r.entity_path);

  // Summarization of the main line, as the sub-agent does it: new files mapped, changed ones re-carded
  model.on('summarization', { automation: 'summarization', kind: 'prompt' }, (t) => {
    if (/src\/priority\.js/.test(t.input)) {
      return [
        move.entity(t, PRIORITY, {
          type: 'Architecture/Component',
          title: 'Priority',
          card: 'Each to-do has a priority (low, normal, high); `byPriority` sorts high first.',
          references: [{ to: STORE, relation: 'extends' }],
          artifacts: ['src/priority.js', 'test/priority.test.js'],
        }),
        move.say('Mapped the priority module.'),
      ];
    }
    if (/package\.json/.test(t.input)) return [move.write(t, kg(REPO), recard(t, REPO, 'Node 20, no dependencies; `npm test` runs `node --test`. Version 1.1.0.')), move.say('Re-carded.')];
    if (/src\/store\.js/.test(t.input)) return [move.write(t, kg(STORE), recard(t, STORE, 'Loads and saves the to-dos as JSON, trimming text; `addTodo`, `completeTodo`, `removeTodo` and `formatTodo` work on the list.')), move.say('Re-carded.')];
    // A typo fixed in the README changes nothing the card says
    return [move.say('The cards still hold.')];
  });

  await step(0, async () => {
    env.commit(WS, { ...TODO_GRAPH, 'README.md': env.show(WS, 'README.md')!.replace(TYPO[0], TYPO[1]) }, 'Map the repository');
    await until('the graph indexed', async () => (await api.entities(WS)).some((e) => e.path === STORE));
    const mapped = (await api.entities(WS)).map((e) => e.path);
    const since = new Date();
    env.commit(WS, { 'src/priority.js': PRIORITY_JS, 'test/priority.test.js': PRIORITY_TEST }, 'Add priorities');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toMatch(/src\/priority\.js[\s\S]*test\/priority\.test\.js/);
    // A new card over the module, since none covered it, waiting in the feed
    const fresh = (await over('src/priority.js')).filter((p) => !mapped.includes(p));
    expect(fresh.length, 'a new entity over src/priority.js').toBeGreaterThan(0);
    priority = fresh[0]!;
    const item = await until('the new card in the feed', async () => (await api.feed()).items.find((i) => i.path === priority));
    expect(item.verification).toBe('unverified');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    await app.approve(WS, priority);
  });

  model.on('the chat writes the story', (t) => t.automation === 'chat' && t.kind === 'prompt' && /due dates/i.test(t.input) && !t.target, (t) => [
    move.entity(t, STORY, {
      type: 'Product/UserStory',
      origin: 'requested',
      title: 'Due dates',
      card: 'As a user I give a to-do a due date, so `list` shows what is overdue.\n\n- **Accepted when:** `todo add <text> --due 2026-10-10` stores the date and an overdue to-do is marked',
      impact: [3, 2, 2],
      references: [{ to: PRODUCT, relation: 'part_of' }],
    }),
    move.say('Wrote the story.'),
  ]);
  model.on('implementation', { automation: 'implementation', kind: 'prompt' }, (t) => [move.write(t, 'src/due.js', DUE_JS), move.say('Implemented due dates.')]);
  model.on('implementation summarizes', { automation: 'implementation', kind: 'summarize' }, (t) => [
    move.entity(t, DUE, {
      type: 'Architecture/Component',
      title: 'Due dates',
      card: '`overdue(todo)` tells a to-do past its due date; done to-dos are never overdue.',
      references: [
        { to: STORY, relation: 'implements' },
        { to: STORE, relation: 'extends' },
      ],
      artifacts: ['src/due.js'],
    }),
    move.say('Summarized.'),
  ]);
  model.on('the review asks for a test', (t) => t.automation === 'chat' && t.target === DUE && t.kind === 'prompt', (t) => [
    move.write(t, 'test/due.test.js', DUE_TEST),
    move.write(t, kg(DUE), readFileSync(t.file(kg(DUE)), 'utf8').replace('  - src/due.js', '  - src/due.js\n  - test/due.test.js')),
    move.say('Added the test.'),
  ]);
  model.subject = (t) => (t.automation === 'implementation' ? 'Add due dates to to-dos' : `Scripted ${t.automation} work`);

  await step(1, async () => {
    const chat = await app.chat(WS, 'People keep asking for due dates on to-dos. Write it up as a user story.');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    const stories = (await entitiesOf(env, WS, chat)).filter((p) => p.startsWith('Product/UserStory/'));
    expect(stories, 'the user story the chat wrote').toHaveLength(1);
    story = stories[0]!;
    const since = new Date();
    await app.approve(WS, story);
    const impl = await api.automationRan(WS, 'implementation', since, 30 * 60_000);
    expect(impl.status).toBe('finished');
    expect(impl.target_path).toBe(story);
    // Code landed, the suite passes, and what the run summarized implements the story
    expect(filesOf(env, WS, await commitsOf(env, WS, impl.id)).some((f) => f.startsWith('src/'))).toBe(true);
    expect(testsPass(env, WS)).toBe(true);
    const results = (await Promise.all((await entitiesOf(env, WS, impl.id)).map((p) => api.entity(WS, p)))).filter((e) => refs(e, 'implements').includes(story));
    expect(results.length, 'an entity implementing the story').toBeGreaterThan(0);
    result = results[0]!.path;
    // Sent back for a test; the test lands, summarized, and the result comes back to the feed
    const review = await app.sendBack(WS, result, 'Before I approve this, add a separate test file test/due.test.js checking that a done to-do is never overdue.');
    expect((await api.runEnded(review, 15 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'test/due.test.js')).toMatch(/overdue/);
    expect(testsPass(env, WS)).toBe(true);
    expect((await over('test/due.test.js')).length, 'an entity over the new test').toBeGreaterThan(0);
    await until('the reviewed result back in the feed', async () => (await api.feed()).items.some((i) => i.path === result));
    await app.approve(WS, result);
    // Back in sync once the approval is through, a moment after its card left the feed
    await until('the story back in sync', async () => (await api.entity(WS, story)).sync === 'synced', 30_000, 500);
    // The code a run summarized itself starts no summarization run
    expect((await summaries()).filter((r) => r.created_at >= since)).toEqual([]);
  });

  await step(2, async () => {
    let since = new Date();
    env.commit(WS, { 'package.json': env.show(WS, 'package.json')!.replace('"version": "1.0.0"', '"version": "1.1.0"') }, 'Release 1.1.0');
    expect((await summarization(since)).status).toBe('finished');
    const repo = await until('the repository card in the feed', async () => (await api.feed()).items.find((i) => i.path === REPO && i.diff));
    expect(repo.verification).toBe('unverified');
    expect((await api.entity(WS, REPO)).markdown).toMatch(/1\.1\.0/);
    await app.approve(WS, REPO);

    since = new Date();
    const feed = (await api.feed()).items.length;
    const card = await api.entity(WS, PRODUCT);
    env.commit(WS, { 'README.md': env.show(WS, 'README.md')!.replace(TYPO[1], TYPO[0]) }, 'Fix a typo in the README');
    expect((await summarization(since)).status).toBe('finished');
    await until('the product synced', async () => (await api.entity(WS, PRODUCT)).sync === 'synced');
    // Nothing for the user to look at: the card still holds, as it was
    expect((await api.feed()).items.length).toBe(feed);
    const after = await api.entity(WS, PRODUCT);
    expect(after.markdown).toBe(card.markdown);
    expect(after.verification).toBe(card.verification);
  });

  model.on('the release chat', (t) => t.automation === 'chat' && t.kind === 'prompt' && /release/i.test(t.input), (t) => [
    move.write(t, 'CHANGELOG.md', '# Changelog\n\n## 1.1.0\n\n- Priorities: low, normal, high\n- Due dates, with overdue to-dos marked\n'),
    move.entity(t, NOTE, {
      type: 'Knowledge/ReleaseNote',
      origin: 'requested',
      title: 'todo-cli 1.1.0',
      card: 'Priorities and due dates: `list` shows high priority first and marks overdue to-dos.',
      references: [
        { to: STORY, relation: 'ships' },
        { to: PRIORITY, relation: 'ships' },
      ],
      artifacts: ['CHANGELOG.md'],
    }),
    move.say('Wrote the changelog and the release note.'),
  ]);

  await step(3, async () => {
    const since = new Date();
    const chat = await app.chat(WS, 'Release 1.1.0: add a 1.1.0 entry to CHANGELOG.md covering everything added since 1.0.0, and a release note in the knowledge base that references what shipped.');
    expect((await api.runEnded(chat, 15 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'CHANGELOG.md')).toMatch(/1\.1\.0/);
    // The release note references what shipped: the priorities, and the due dates or what implements them
    const notes = (await Promise.all((await entitiesOf(env, WS, chat)).map((p) => api.entity(WS, p)))).filter((e) => /^(Knowledge\/ReleaseNote|Product\/Release)$/.test(e.type));
    expect(notes.length, 'a release note').toBeGreaterThan(0);
    const note = notes.find((n) => n.references.some((r) => r.direction === 'out' && r.path === priority))!;
    expect(note, `a release note referencing ${priority}`).toBeTruthy();
    const outs = note.references.filter((r) => r.direction === 'out').map((r) => r.path);
    expect(outs.some((p) => p === story || p === result), `the due dates among ${outs.join(', ')}`).toBe(true);
    await app.approve(WS, note.path);
    await new Promise((r) => setTimeout(r, 6000));
    expect((await summaries()).filter((r) => r.created_at >= since)).toEqual([]);
  });

  await step(4, async () => {
    const since = new Date();
    env.commit(WS, { 'src/store.js': env.show(WS, 'src/store.js')!.replace("throw new Error('a to-do needs some text')", "throw new Error('a to-do needs some text; nothing was added')") }, 'Say nothing was added');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    // One run, over the cards of that file, which changes nothing else
    const cards = await over('src/store.js');
    expect(cards).toContain(STORE);
    for (const c of cards) expect(model.turns(run.id)[0]!.input).toMatch(new RegExp(`^- ${c}: .*src/store\\.js`, 'm'));
    expect((await summaries()).filter((r) => r.created_at >= since)).toHaveLength(1);
    const touched = filesOf(env, WS, await commitsOf(env, WS, run.id)).filter((f) => f.startsWith('knowledge-graph/'));
    expect(touched.filter((f) => !cards.map(kg).includes(f))).toEqual([]);
    for (const c of cards) expect((await api.entity(WS, c)).sync).toBe('synced');
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
  });
});
