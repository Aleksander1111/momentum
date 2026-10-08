import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const TOTAL = 3;
const QUESTIONS = [
  'Which routes does the API have?',
  'What does GET /books/:id answer for a missing book?',
  'Where are the books stored?',
  'What does POST /books answer when the author is missing?',
  'How many books does the store start with?',
];
const FOLLOW_UP = 'And what does it answer when the body is not JSON?';

// Many questions at once on a busy day, within a total of three runs
scenario('busy-chat-day', { enabled: [WS], settings: { agents: { concurrentTotal: TOTAL } } }, async ({ api, app, model, step }) => {
  // Each turn's first answer waits until the scenario lets the chats go: held at the network, live too
  let open = () => {};
  let gate = new Promise<void>((r) => (open = r));
  model.on('chats', { automation: 'chat' }, (t) =>
    t.kind === 'prompt' || t.kind === 'message' ? [move.gate(gate), move.say(`Answered: ${t.input.split('\n').filter(Boolean).join(' | ')}; invalid input answers 400.`)] : undefined,
  );
  const status = async (id: string) => (await api.run(id)).status;
  const chats: string[] = [];

  await step(0, async () => {
    for (const q of QUESTIONS) chats.push((await api.chat(WS, q)).runId);
    await until('three running', async () => (await Promise.all(chats.map(status))).filter((s) => s === 'running').length === TOTAL, 60_000);
    const states = await Promise.all(chats.map(status));
    expect(states.filter((s) => s === 'queued')).toHaveLength(2);
    // The oldest go first
    expect(states.slice(0, TOTAL)).toEqual(['running', 'running', 'running']);
  });

  await step(1, async () => {
    // A follow-up to a chat still waiting joins its first question
    await app.reply(chats[3]!, FOLLOW_UP);
    expect(await status(chats[3]!)).toBe('queued');
    open();
    gate = Promise.resolve();
    await until('all answered', async () => (await Promise.all(chats.map(status))).every((s) => s === 'finished'), 15 * 60_000, 5000);
    // One turn answered both: the run started with the question and its follow-up together, and was never asked again
    const turns = model.turns(chats[3]!);
    expect(turns.filter((t) => t.kind === 'message')).toEqual([]);
    const asked = turns.find((t) => t.kind === 'prompt')!.input;
    expect(asked).toContain(QUESTIONS[3]);
    expect(asked).toContain(FOLLOW_UP);
    // Both are 400s in src/server.js
    expect(await api.answer(chats[3]!)).toMatch(/400/);
  });

  await step(2, async () => {
    gate = new Promise<void>((r) => (open = r));
    const onEntity = await api.chat(WS, 'Explain the validation rules of this API.', API);
    await until('the chat on the entity running', async () => (await status(onEntity.runId)) === 'running');
    // The user swipes the same entity back from the feed meanwhile: the comment joins that chat
    const sent = await api.call<{ runId: string }>('POST', `/feed/${encodeURIComponent(API)}/send-back`, { workspace: WS, comment: 'Also say what a body that is not JSON answers.', timeSpentMs: 800 });
    expect(sent.runId).toBe(onEntity.runId);
    open();
    gate = Promise.resolve();
    expect((await api.answered(onEntity.runId, 2, 15 * 60_000)).status).toBe('finished');
    expect((await api.runs(WS, 'chat')).filter((r) => r.target_path === API)).toHaveLength(1);
  });

  await step(3, async () => {
    gate = new Promise<void>((r) => (open = r));
    const busy = await Promise.all(['Which port does the server listen on?', 'Which test covers the 404?', 'What does a book look like?'].map((q) => api.chat(WS, q)));
    await until('three running', async () => (await Promise.all(busy.map((b) => status(b.runId)))).every((s) => s === 'running'), 60_000);
    const waiting = await api.chat(WS, 'Never mind this one.');
    expect(await status(waiting.runId)).toBe('queued');
    // Stopped while it waits: it never starts
    await api.mcp('kill_run', { id: waiting.runId });
    expect(await status(waiting.runId)).toBe('killed');
    open();
    gate = Promise.resolve();
    await until('the others answered', async () => (await Promise.all(busy.map((b) => status(b.runId)))).every((s) => s === 'finished'), 15 * 60_000, 5000);
    await new Promise((r) => setTimeout(r, 6000));
    expect(await status(waiting.runId)).toBe('killed');
    expect(model.turns(waiting.runId)).toEqual([]);
    await app.tab('Sessions');
  });
});
