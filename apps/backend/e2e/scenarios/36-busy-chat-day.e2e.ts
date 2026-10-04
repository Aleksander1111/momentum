import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const TOTAL = 3;

// Many questions at once on a busy day, within a total of three runs
scenario('busy-chat-day', { enabled: [WS], settings: { agents: { concurrentTotal: TOTAL } } }, async ({ api, app, model, step }) => {
  let open = () => {};
  let gate = new Promise<void>((r) => (open = r));
  model.on('chats', { automation: 'chat' }, (t) =>
    t.kind === 'prompt' || t.kind === 'message' ? [move.gate(gate), move.say(`Answered: ${t.input.split('\n').filter(Boolean).join(' | ')}`)] : undefined,
  );
  const status = async (id: string) => (await api.run(id)).status;
  const chats: string[] = [];

  await step(0, async () => {
    for (let i = 1; i <= 5; i++) chats.push((await api.chat(WS, `Question ${i}?`)).runId);
    await until('three running', async () => (await Promise.all(chats.map(status))).filter((s) => s === 'running').length === TOTAL, 60_000);
    const states = await Promise.all(chats.map(status));
    expect(states.filter((s) => s === 'queued')).toHaveLength(2);
    // The oldest go first
    expect(states.slice(0, TOTAL)).toEqual(['running', 'running', 'running']);
  });

  await step(1, async () => {
    // A follow-up to a chat still waiting joins its first question
    await app.reply(chats[3]!, 'And a follow-up to question 4.');
    expect(await status(chats[3]!)).toBe('queued');
    open();
    gate = Promise.resolve();
    await until('all answered', async () => (await Promise.all(chats.map(status))).every((s) => s === 'finished'), 3 * 60_000);
    const fourth = await api.run(chats[3]!);
    const answers = fourth.messages.filter((m) => m.role === 'assistant');
    expect(answers).toHaveLength(1);
    expect(answers[0]!.text).toContain('Question 4?');
    expect(answers[0]!.text).toContain('And a follow-up to question 4.');
  });

  await step(2, async () => {
    gate = new Promise<void>((r) => (open = r));
    const onEntity = await api.chat(WS, 'Explain the validation rules of this API.', API);
    await until('the chat on the entity running', async () => (await status(onEntity.runId)) === 'running');
    // The user swipes the same entity back from the feed meanwhile: the comment joins that chat
    const sent = await api.call<{ runId: string }>('POST', `/feed/${encodeURIComponent(API)}/send-back`, { workspace: WS, comment: 'Also say empty titles are refused.', timeSpentMs: 800 });
    expect(sent.runId).toBe(onEntity.runId);
    open();
    gate = Promise.resolve();
    await until('the chat to answer both', async () => (await api.run(onEntity.runId)).messages.filter((m) => m.role === 'user').length === 2 && (await status(onEntity.runId)) === 'finished', 2 * 60_000);
    expect((await api.runs(WS, 'chat')).filter((r) => r.target_path === API)).toHaveLength(1);
  });

  await step(3, async () => {
    gate = new Promise<void>((r) => (open = r));
    const busy = await Promise.all([1, 2, 3].map((i) => api.chat(WS, `Busy ${i}?`)));
    await until('three running', async () => (await Promise.all(busy.map((b) => status(b.runId)))).every((s) => s === 'running'), 60_000);
    const waiting = await api.chat(WS, 'Never mind this one.');
    expect(await status(waiting.runId)).toBe('queued');
    // Stopped while it waits: it never starts
    await api.mcp('kill_run', { id: waiting.runId });
    expect(await status(waiting.runId)).toBe('killed');
    open();
    gate = Promise.resolve();
    await until('the others answered', async () => (await Promise.all(busy.map((b) => status(b.runId)))).every((s) => s === 'finished'), 2 * 60_000);
    await new Promise((r) => setTimeout(r, 6000));
    expect(await status(waiting.runId)).toBe('killed');
    expect(model.turns(waiting.runId)).toEqual([]);
    await app.tab('Chat');
  });
});
