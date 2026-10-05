import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { plain, sides } from '../support/diff.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { TODO_GRAPH } from '../support/life.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'todo-cli';
const CLI = 'Architecture/Component/cli';
const kg = (p: string) => `knowledge-graph/${p}.md`;
const CHANGE = 'Add to the card that `list` prints "Nothing to do." when there are no to-dos.';
const DRAFT = 'Parses `add`, `list`, `done` and `remove`, reads `TODO_FILE` and calls the store; `list` prints "Nothing to do." when empty.';
/** Three rounds, each adding a fact src/cli.js bears out, and what the card says once it is in */
const ROUNDS = [
  { comment: 'Also say the to-dos are kept in ~/.todo.json unless TODO_FILE names another file.', fact: /\.todo\.json/, card: `${DRAFT} The list is kept in \`~/.todo.json\` unless \`TODO_FILE\` names another file.` },
  { comment: 'Also say an unknown command prints the usage and exits with code 1.', fact: /usage/i, card: '' },
  { comment: 'Also say that done and remove take the id of the to-do.', fact: /\bids?\b/i, card: '' },
];
ROUNDS[1]!.card = `${ROUNDS[0]!.card} An unknown command prints the usage and exits with code 1.`;
ROUNDS[2]!.card = `${ROUNDS[1]!.card} \`done\` and \`remove\` take the id of the to-do.`;
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
  const item = () => until('the card in the feed', async () => (await api.feed()).items.find((i) => i.path === CLI && i.diff), 60_000);
  /** The card the user approved last, as it reads */
  let approved = '';

  model.on('a first draft', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.target === CLI && t.input.includes('Nothing to do'), (t) => [
    move.write(t, kg(CLI), cli(DRAFT)),
    move.say('Updated the card.'),
  ]);
  for (const r of ROUNDS) {
    model.on(`round: ${r.comment}`, (t) => t.automation === 'chat' && t.target === CLI && t.kind === 'prompt' && t.input.includes(r.comment), (t) => [move.write(t, kg(CLI), cli(r.card)), move.say('Revised.')]);
  }

  await step(0, async () => {
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    await until('the graph indexed', async () => (await api.entities(WS)).some((e) => e.path === CLI));
    approved = plain((await api.entity(WS, CLI)).card);
    const chat = await api.chat(WS, CHANGE, CLI);
    expect((await api.runEnded(chat.runId, 10 * 60_000)).status).toBe('finished');
    const first = await item();
    // The diff is against the version the user approved: its before side is that card, its after side the change
    const { before, after } = sides(first.diff!);
    expect(before).toBe(approved);
    expect(after).toMatch(/Nothing to do/);
  });

  await step(1, async () => {
    let previous = sides((await item()).diff!).after;
    for (const r of ROUNDS) {
      const chat = await app.sendBack(WS, CLI, r.comment);
      expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
      const next = await item();
      const { before, after } = sides(next.diff!);
      // Each round diffs against the approved version, never against the round before
      expect(before).toBe(approved);
      expect(before).not.toBe(previous);
      expect(after).toMatch(r.fact);
      expect(after).toMatch(/Nothing to do/);
      previous = after;
    }
  });

  await step(2, async () => {
    await app.approve(WS, CLI);
    const e = await api.entity(WS, CLI);
    expect(e.verification).toBe('verified');
    expect(e.diff).toBeNull();
    for (const r of ROUNDS) expect(e.markdown).toMatch(r.fact);
    approved = plain(e.card);
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
    const chat = await api.chat(WS, 'Mention that done to-dos are listed with an x; update the card.', CLI);
    expect((await api.runEnded(chat.runId, 10 * 60_000)).status).toBe('finished');
    const { before, after } = sides((await item()).diff!);
    expect(before).toBe(approved);
    expect(after).toMatch(/\[x\]|\bx\b/);
  });
});
