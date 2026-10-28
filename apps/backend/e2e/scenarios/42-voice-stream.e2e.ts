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
  const field = () => app.frame().getByPlaceholder(`Ask ${WS}`, { exact: true });
  /** The field holds each stretch said, once, in the order said */
  const holds = (n: number) => expect(field()).toHaveValue(SAID.slice(0, n).join(' '), { timeout: 15_000 });

  await step(0, async () => {
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    for (const said of SAID.slice(0, 3)) voice.say(said);
    await holds(3);
    expect(await api.runs(WS, 'chat')).toEqual([]);
  });

  await step(1, async () => {
    const resyncs = voice.resyncs;
    // The event before this one never arrives: the harness sees the hole and reads the stream's state afresh
    voice.say(SAID[3]!, 'command', { hole: true });
    await holds(4);
    expect(voice.resyncs).toBe(resyncs + 1);
  });

  await step(2, async () => {
    // Delivered again, with the sequence numbers they had
    voice.replay(1);
    voice.replay(4);
    await new Promise((r) => setTimeout(r, 6000));
    await holds(4);
    // The connection drops: the harness reconnects and gets a fresh snapshot of everything said
    voice.dropFeed();
    await new Promise((r) => setTimeout(r, 8000));
    await holds(4);
    await app.stopSpeaking();
    await holds(4);
    // Sent once, as one message
    const since = new Date();
    await field().press('Enter');
    const chat = await until('the chat', async () => (await api.runs(WS, 'chat')).find((r) => r.created_at >= since), 60_000);
    expect((await api.run(chat.id)).messages.filter((m) => m.role === 'user').map((m) => m.text)).toEqual([SAID.join(' ')]);
    // Nor after a restart: the field it opens with is empty
    env.stop();
    await env.start();
    await app.open();
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    await new Promise((r) => setTimeout(r, 10_000));
    await expect(field()).toHaveValue('');
    await app.stopSpeaking();
    expect(await api.runs(WS)).toHaveLength(1);
  });
});
