import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { TODO_GRAPH } from '../support/life.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'todo-cli';
const CLI = 'Architecture/Component/cli';
const kg = (p: string) => `knowledge-graph/${p}.md`;
const ROUNDS = [
  { comment: 'Say that list sorts by priority.', card: 'Parses `add`, `list`, `done` and `remove`; `list` sorts by priority.' },
  { comment: 'Mention TODO_FILE again, you dropped it.', card: 'Parses `add`, `list`, `done` and `remove`, reads `TODO_FILE`; `list` sorts by priority.' },
  { comment: 'Keep the store dependency in the card text too.', card: 'Parses `add`, `list`, `done` and `remove`, reads `TODO_FILE` and calls the store; `list` sorts by priority.' },
];
const cli = (card: string) =>
  entityText({
    type: 'Architecture/Component',
    title: 'Command line',
    card,
    references: [
      { to: 'Product/Product/todo-cli', relation: 'part_of' },
      { to: 'Architecture/Component/store', relation: 'depends_on' },
    ],
    artifacts: ['src/cli.js'],
  });

// A card goes through review rounds before the user approves it
scenario('review-rounds', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  const item = () => until('the card in the feed', async () => (await api.feed()).items.find((i) => i.path === CLI), 60_000);
  const text = (blocks: unknown) => JSON.stringify(blocks);

  model.on('a first draft', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.target === CLI && t.input.includes('now sorts by priority'), (t) => [
    move.write(t, kg(CLI), cli('Parses commands; `list` shows high priority first.')),
    move.say('Updated the card.'),
  ]);
  for (const r of ROUNDS) {
    model.on(`round: ${r.comment}`, (t) => t.automation === 'chat' && t.target === CLI && t.kind === 'prompt' && t.input.includes(r.comment), (t) => [move.write(t, kg(CLI), cli(r.card)), move.say('Revised.')]);
  }

  await step(0, async () => {
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    await until('the graph indexed', async () => (await api.entities(WS)).some((e) => e.path === CLI));
    const chat = await api.chat(WS, 'The list command now sorts by priority; update the card.', CLI);
    expect((await api.runEnded(chat.runId, 3 * 60_000)).status).toBe('finished');
    const first = await item();
    expect(first.diff).not.toBeNull();
    // The diff is against the version the user approved: it shows what the original said
    expect(text(first.diff)).toContain('TODO_FILE');
  });

  await step(1, async () => {
    for (const [i, r] of ROUNDS.entries()) {
      const chat = await app.sendBack(WS, CLI, r.comment);
      expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
      const next = await item();
      // Each round diffs against the approved version, never against the round before: the draft is nowhere in it
      expect(text(next.diff)).not.toContain('Parses commands;');
      expect(text(next.card)).toContain(i === 0 ? 'sorts by priority' : 'TODO_FILE');
    }
  });

  await step(2, async () => {
    await app.approve(WS, CLI);
    const e = await api.entity(WS, CLI);
    expect(e.verification).toBe('verified');
    expect(e.diff).toBeNull();
    expect(e.markdown).toContain(ROUNDS.at(-1)!.card);
    const m = await api.metrics(WS);
    expect(m.attention.sentBack.value).toBe(3);
    expect(m.attention.approved.value).toBe(1);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=user&limit=50`);
    const comments = events.filter((e) => e.kind === 'sent_back').map((e) => e.detail);
    expect(comments).toEqual(ROUNDS.map((r) => r.comment).reverse());
  });

  await step(3, async () => {
    // A later change diffs against the card approved in step 2, not the original
    model.on('a later change', (t) => t.automation === 'chat' && t.target === CLI && /done to-dos/.test(t.input), (t) => [move.write(t, kg(CLI), cli(`${ROUNDS.at(-1)!.card} Done to-dos show an x.`)), move.say('Updated.')]);
    const chat = await api.chat(WS, 'Mention that done to-dos are shown with an x; update the card.', CLI);
    expect((await api.runEnded(chat.runId, 3 * 60_000)).status).toBe('finished');
    const next = await item();
    expect(text(next.diff)).toContain('Done to-dos show an x');
    expect(text(next.diff)).not.toContain('Parses commands;');
  });
});
