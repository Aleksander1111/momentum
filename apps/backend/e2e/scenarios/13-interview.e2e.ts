import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'bookshelf-api';

scenario('interview', { enabled: [WS], voice: true }, async ({ env, api, app, voice, step }) => {
  /** The interview's next question, once its turn has ended */
  const turn = async (runId: string, n: number) =>
    until(`turn ${n} of the interview`, async () => {
      const astray = await api.runs(WS, 'chat');
      if (astray.length) throw Object.assign(new Error(`What was said went to a new chat, not the interview: "${astray[0]!.title}"`), { fatal: true });
      const r = await api.run(runId);
      return r.status !== 'running' && r.status !== 'queued' && r.messages.filter((m) => m.role === 'user').length >= n ? r : null;
    }, 15 * 60_000);

  /** Starts the mic of the screen; what is said next goes where this screen sends it once its audio reaches the stream */
  const listen = async () => {
    const before = voice.opened;
    await app.speak();
    await until('the mic to reach the command stream', async () => voice.opened > before);
  };

  const runId = await step(0, async () => {
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    const since = new Date();
    voice.say('interview the reading list features');
    const run = await until('the interview run', async () => (await api.runs(WS, 'interview')).find((r) => r.created_at >= since));
    const first = await turn(run.id, 1);
    expect(first.interview?.question).toBeTruthy();
    return run.id;
  });

  await step(1, async () => {
    await app.go(`/chat/${runId}`);
    await listen();
    voice.say('I want to find books by author and by year, and mark books I have read');
    let r = await turn(runId, 2);
    const doc = r.interview!.document;
    expect(doc).toMatch(/^interviews\//);
    await until('the answer on the main line', async () => /author/i.test(env.show(WS, doc) ?? ''));
    voice.say('skip');
    r = await turn(runId, 3);
    voice.say('why do you ask that', 'question');
    r = await turn(runId, 4);
    expect(r.messages.some((m) => m.role === 'user' && m.text.startsWith('Question: '))).toBe(true);
    expect(r.interview!.document).toBe(doc);
    expect(r.interview!.done).toBe(false);
  });

  await step(2, async () => {
    voice.say('stop interview');
    const r = await until('the interview done', async () => {
      const x = await api.run(runId);
      return x.interview?.done && x.status !== 'running' && x.status !== 'queued' ? x : null;
    }, 15 * 60_000);
    const doc = r.interview!.document;
    const summaries = await until('the interview summarized', async () => {
      const rows = await env.sql<{ entity_path: string }[]>`select entity_path from ${env.sql('ws_bookshelf_api.entity_artifact')} where artifact_path = ${doc}`;
      return rows.length ? rows : null;
    }, 15 * 60_000);
    expect(summaries.length).toBeGreaterThan(0);
    // Once: no summarization run of its own followed for the same document
    await new Promise((r) => setTimeout(r, 10_000));
    expect((await api.runs(WS, 'summarization')).filter((x) => x.title.includes(doc))).toEqual([]);
  });
});
