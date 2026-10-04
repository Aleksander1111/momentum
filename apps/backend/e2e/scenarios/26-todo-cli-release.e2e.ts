import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
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

/** An entity file of the checkout with a new card, unverified as a run leaves it */
const recard = (t: Turn, path: string, card: string, extra: (text: string) => string = (x) => x) => {
  const text = readFileSync(t.file(kg(path)), 'utf8').replace('verification: verified', 'verification: unverified');
  return extra(text.replace(/(\n# [^\n]+\n)[\s\S]*$/, `$1\n${card}\n`));
};

// The knowledge graph is built and approved; from here on, the developer and the harness keep it true day by day
scenario('todo-cli-release', { enabled: [WS], graphBuild: 'complete', triggers: ['implementation'] }, async ({ env, api, app, model, step }) => {
  const summaries = () => api.runs(WS, 'summarization');
  const summarization = (since: Date) => api.automationRan(WS, 'summarization', since, 3 * 60_000);

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
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    await until('the graph indexed', async () => (await api.entities(WS)).some((e) => e.path === STORE));
    const since = new Date();
    env.commit(WS, { 'src/priority.js': PRIORITY_JS, 'test/priority.test.js': PRIORITY_TEST }, 'Add priorities');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toMatch(/src\/priority\.js[\s\S]*test\/priority\.test\.js/);
    const item = await until('the new component in the feed', async () => (await api.feed()).items.find((i) => i.path === PRIORITY));
    expect(item.verification).toBe('unverified');
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    await app.approve(WS, PRIORITY);
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
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    const since = new Date();
    await app.approve(WS, STORY);
    const impl = await api.automationRan(WS, 'implementation', since, 3 * 60_000);
    expect(impl.status).toBe('finished');
    expect(impl.target_path).toBe(STORY);
    expect(env.show(WS, 'src/due.js')).toContain('overdue');
    const review = await app.sendBack(WS, DUE, 'Add a test for overdue before I approve it.');
    expect((await api.runEnded(review, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'test/due.test.js')).toContain('is overdue');
    await until('the reviewed component back in the feed', async () => (await api.feed()).items.some((i) => i.path === DUE));
    expect((await api.entity(WS, DUE)).artifacts.map((a) => a.path).sort()).toEqual(['src/due.js', 'test/due.test.js']);
    await app.approve(WS, DUE);
    expect((await api.entity(WS, STORY)).sync).toBe('synced');
    // The code a run summarized itself starts no summarization run
    expect((await summaries()).filter((r) => r.created_at >= since)).toEqual([]);
  });

  await step(2, async () => {
    let since = new Date();
    env.commit(WS, { 'package.json': env.show(WS, 'package.json')!.replace('"version": "1.0.0"', '"version": "1.1.0"') }, 'Release 1.1.0');
    expect((await summarization(since)).status).toBe('finished');
    const repo = await until('the repository card in the feed', async () => (await api.feed()).items.find((i) => i.path === REPO && i.diff));
    expect(repo.verification).toBe('unverified');
    await app.approve(WS, REPO);

    since = new Date();
    const feed = (await api.feed()).items.length;
    env.commit(WS, { 'README.md': env.show(WS, 'README.md')!.replace('A tiny command-line', 'A tiny, fast command-line') }, 'Tweak the README');
    expect((await summarization(since)).status).toBe('finished');
    await until('the product synced', async () => (await api.entity(WS, PRODUCT)).sync === 'synced');
    // Nothing for the user to look at: the card still holds
    expect((await api.feed()).items.length).toBe(feed);
    expect((await api.entity(WS, PRODUCT)).verification).toBe('verified');
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
    const chat = await app.chat(WS, 'Write the release notes for 1.1.0 and a CHANGELOG.');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'CHANGELOG.md')).toContain('## 1.1.0');
    await app.approve(WS, NOTE);
    expect((await api.entity(WS, NOTE)).references.map((r) => r.path).sort()).toEqual([PRIORITY, STORY].sort());
    await new Promise((r) => setTimeout(r, 6000));
    expect((await summaries()).filter((r) => r.created_at >= since)).toEqual([]);
  });

  await step(4, async () => {
    const since = new Date();
    env.commit(WS, { 'src/store.js': env.show(WS, 'src/store.js')!.replace("throw new Error('a to-do needs some text')", "throw new Error('a to-do needs some text; nothing was added')") }, 'Say nothing was added');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toContain(`- ${STORE}: src/store.js`);
    expect((await summaries()).filter((r) => r.created_at >= since)).toHaveLength(1);
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await missingArtifacts(env, WS, env.sql)).toEqual([]);
    expect((await api.feed()).items.filter((i) => i.workspace === WS && i.type !== 'Harness/Trigger').map((i) => i.path)).toEqual([STORE]);
  });
});
