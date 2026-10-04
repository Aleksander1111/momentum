import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const DOC = 'interviews/reading-habits.md';
const SUMMARY = 'Knowledge/MeetingNote/reading-habits';

scenario('voice', { enabled: [WS], voice: true }, async ({ env, api, app, voice, model, step }) => {
  const listen = async () => {
    const before = voice.opened;
    await app.speak();
    await until('the mic to reach the command stream', async () => voice.opened > before);
  };
  const chats = () => api.runs(WS, 'chat');
  const newest = async (since: Date) => until('a run started by voice', async () => (await api.runs(WS)).find((r) => r.created_at >= since), 60_000);

  model.on('chats answer', { automation: 'chat' }, (t) => (t.kind === 'prompt' || t.kind === 'message' ? [move.say(`Heard: ${t.input.split('\n').at(-1)}`)] : undefined));

  // The interviewer: one question per turn, every answer appended to the one document
  const QUESTIONS = ['How many books do you read a month?', 'Where do you keep the list of books to read?', 'What makes you stop reading a book?'];
  model.on('interviewer', { automation: 'interview' }, (t: Turn) => {
    if (t.kind === 'summarize') {
      return [
        move.entity(t, SUMMARY, { type: 'Knowledge/MeetingNote', origin: 'user', title: 'Reading habits', card: 'Two books a month, listed on paper; a slow start ends a book.', artifacts: [DOC] }),
        move.say('Summarized.'),
      ];
    }
    if (t.kind !== 'prompt' && t.kind !== 'message') return undefined;
    const answers = t.inputs.slice(1);
    const done = /stop interview/i.test(t.input);
    const before = (() => {
      try {
        return readFileSync(t.file(DOC), 'utf8');
      } catch {
        return '# Reading habits\n';
      }
    })();
    const text = answers.length ? `${before.trimEnd()}\n\n- ${QUESTIONS[answers.length - 1] ?? 'More'}: ${t.input}\n` : before;
    return [
      move.write(t, DOC, text),
      move.interview({ question: done ? 'Thank you, that is all.' : QUESTIONS[answers.length] ?? 'Anything else?', done, document: DOC }),
      move.say(done ? 'Thank you.' : QUESTIONS[answers.length] ?? 'Anything else?'),
    ];
  });

  await step(0, async () => {
    await app.go(`/explorer?ws=${WS}`);
    await listen();
    voice.say('books by author');
    await expect(app.frame().getByPlaceholder('Search entities')).toHaveValue('books by author', { timeout: 15_000 });
    expect(await chats()).toEqual([]);

    await app.entity(WS, API);
    await listen();
    let since = new Date();
    voice.say('which route creates a book', 'question');
    const asked = await newest(since);
    expect((await api.run(asked.id)).messages[0]!.context.map((c) => c.path)).toEqual([API]);
    expect(asked.target_path).toBeNull();
    since = new Date();
    voice.say('say that empty titles are refused', 'command');
    const told = await newest(since);
    expect(told.target_path).toBe(API);
    for (const r of [asked, told]) await api.runEnded(r.id, 2 * 60_000);
  });

  await step(1, async () => {
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    const since = new Date();
    voice.say('which routes are there', 'question');
    const chat = await newest(since);
    await api.runEnded(chat.id, 2 * 60_000);
    voice.say('and which one deletes a book', 'question');
    await until('the follow-up in the same chat', async () => (await api.run(chat.id)).messages.filter((m) => m.role === 'user').length === 2, 60_000);
    voice.say('stop interview');
    await new Promise((r) => setTimeout(r, 6000));
    expect((await chats()).filter((r) => r.created_at >= since)).toHaveLength(1);
    expect((await api.run(chat.id)).messages.some((m) => /stop interview/i.test(m.text))).toBe(false);
  });

  const interview = await step(2, async () => {
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    const since = new Date();
    voice.say('interview reading habits');
    const run = await until('the interview', async () => (await api.runs(WS, 'interview')).find((r) => r.created_at >= since), 60_000);
    // A turn is over once the interviewer has said its next question and the run has ended again
    const turn = (n: number) =>
      until(`turn ${n}`, async () => {
        const said = model.turns(run.id).filter((t) => (t.kind === 'prompt' || t.kind === 'message') && t.step === 2).length;
        const r = await api.run(run.id);
        return said >= n && r.status !== 'running' && r.status !== 'queued' ? r : null;
      }, 2 * 60_000);
    expect((await turn(1)).interview!.question).toBe(QUESTIONS[0]);
    await app.go(`/chat/${run.id}`);
    await listen();
    voice.say('about two a month');
    expect((await turn(2)).interview!.question).toBe(QUESTIONS[1]);
    voice.say('skip');
    await turn(3);
    voice.say('why do you ask', 'question');
    const r = await turn(4);
    expect(r.messages.some((m) => m.role === 'user' && m.text === 'Question: why do you ask')).toBe(true);
    expect(r.interview!.document).toBe(DOC);
    expect(r.interview!.done).toBe(false);
    const doc = env.show(WS, DOC)!;
    expect(doc).toContain('about two a month');
    expect(doc).toContain('Question: why do you ask');
    // Not summarized while it goes on
    expect((await api.entities(WS)).some((e) => e.path === SUMMARY)).toBe(false);
    return run.id;
  });

  await step(3, async () => {
    voice.say('stop interview');
    const r = await until('the interview done', async () => {
      const x = await api.run(interview);
      return x.interview?.done && x.status !== 'running' && x.status !== 'queued' ? x : null;
    }, 2 * 60_000);
    expect(r.status).toBe('finished');
    const note = await until('the summary', async () => (await api.entities(WS)).find((e) => e.path === SUMMARY), 60_000);
    expect(note.verification).toBe('unverified');
    expect((await api.entity(WS, SUMMARY)).artifacts.map((a) => a.path)).toEqual([DOC]);
    await new Promise((r) => setTimeout(r, 6000));
    expect(await api.runs(WS, 'summarization')).toEqual([]);
  });

  await step(4, async () => {
    const before = (await api.runs(WS)).length;
    env.stop();
    await env.start();
    await app.open();
    await new Promise((r) => setTimeout(r, 10_000));
    expect((await api.runs(WS)).length).toBe(before);
  });
});
