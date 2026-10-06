import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const SAID = ['which routes are there', 'which one creates a book', 'what does a missing book answer', 'where are the books stored'];

// The command stream as a flaky network delivers it: in order, with a hole, twice, and dropped
scenario('voice-stream', { enabled: [WS], voice: true }, async ({ env, api, app, voice, model, step }) => {
  model.on('chats answer', { automation: 'chat' }, (t) => (t.kind === 'prompt' || t.kind === 'message' ? [move.say(`Heard: ${t.input.split('\n').at(-1)}`)] : undefined));
  const listen = async () => {
    const before = voice.opened;
    await app.speak();
    await until('the mic to reach the command stream', async () => voice.opened > before);
  };
  /** What the user said in the chat, in the order the harness took it */
  const heard = async (id: string) => (await api.run(id)).messages.filter((m) => m.role === 'user').map((m) => m.text);
  let chat = '';

  await step(0, async () => {
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    const since = new Date();
    voice.say(SAID[0]!, 'question');
    chat = (await until('the chat', async () => (await api.runs(WS, 'chat')).find((r) => r.created_at >= since), 60_000)).id;
    await api.answered(chat, 1, 5 * 60_000);
    voice.say(SAID[1]!, 'question');
    await api.answered(chat, 2, 5 * 60_000);
    voice.say(SAID[2]!, 'question');
    await api.answered(chat, 3, 5 * 60_000);
    expect(await heard(chat)).toEqual(SAID.slice(0, 3));
    expect(await api.runs(WS, 'chat')).toHaveLength(1);
  });

  await step(1, async () => {
    const resyncs = voice.resyncs;
    // The event before this one never arrives: the harness sees the hole and reads the stream's state afresh
    voice.say(SAID[3]!, 'question', { hole: true });
    await api.answered(chat, 4, 5 * 60_000);
    expect(voice.resyncs).toBe(resyncs + 1);
    expect(await heard(chat)).toEqual(SAID);
    expect(await api.runs(WS, 'chat')).toHaveLength(1);
  });

  await step(2, async () => {
    // Delivered again, with the sequence numbers they had
    voice.replay(1);
    voice.replay(4);
    await new Promise((r) => setTimeout(r, 6000));
    expect(await heard(chat)).toEqual(SAID);
    // The connection drops: the harness reconnects and gets a fresh snapshot of everything said
    voice.dropFeed();
    await new Promise((r) => setTimeout(r, 8000));
    expect(await heard(chat)).toEqual(SAID);
    expect(await api.runs(WS)).toHaveLength(1);
    // Nor after a restart
    env.stop();
    await env.start();
    await app.open();
    await new Promise((r) => setTimeout(r, 10_000));
    expect(await heard(chat)).toEqual(SAID);
    expect(await api.runs(WS)).toHaveLength(1);
    await app.go(`/chat/${chat}`);
    await expect(app.text(SAID[3]!, false).first()).toBeVisible({ timeout: 15_000 });
  });
});
