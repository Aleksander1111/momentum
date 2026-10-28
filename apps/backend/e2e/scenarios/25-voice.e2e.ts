import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
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
  const newest = async (since: Date) => until('a run started from the field', async () => (await api.runs(WS)).find((r) => r.created_at >= since), 60_000);
  const field = (placeholder: string) => app.frame().getByPlaceholder(placeholder, { exact: true });
  /** Says the text into the empty field's mic, stops it and sends what the field holds, as the user does */
  const dictate = async (placeholder: string, text: string, kind: 'command' | 'question' = 'command') => {
    await listen();
    voice.hear(text, kind);
    await expect(field(placeholder)).toHaveValue(kind === 'question' ? `Question: ${text}` : text, { timeout: 15_000 });
    await app.stopSpeaking();
    await field(placeholder).press('Enter');
  };

  model.on('chats answer', { automation: 'chat' }, (t) => (t.kind === 'prompt' || t.kind === 'message' ? [move.say(`Heard: ${t.input.split('\n').at(-1)}`)] : undefined));

  // The interviewer: one question per turn, every answer appended to the one document
  const QUESTIONS = ['How many books do you read a month?', 'Where do you keep the list of books to read?', 'What makes you stop reading a book?'];
  model.on('interviewer', { automation: 'interview' }, (t: Turn) => {
    if (t.kind === 'summarize') {
      return [
        move.summarize(),
        move.entity(t, SUMMARY, { type: 'Knowledge/MeetingNote', origin: 'user', title: 'Reading habits', card: 'Two books a month, listed on paper; a slow start ends a book.', artifacts: [DOC] }),
        move.say('Summarized.'),
      ];
    }
    if (t.kind !== 'prompt' && t.kind !== 'message') return undefined;
    // Skips and questions back write nothing
    const answers = t.inputs.slice(1).filter((a) => !/^(skip|Question:)/i.test(a));
    const done = /stop interview/i.test(t.input);
    const before = (() => {
      try {
        return readFileSync(t.file(DOC), 'utf8');
      } catch {
        return '# Reading habits\n';
      }
    })();
    const answered = answers.length && t.input === answers.at(-1);
    const text = answered ? `${before.trimEnd()}\n\n- ${QUESTIONS[answers.length - 1] ?? 'More'}: ${t.input}\n` : before;
    return [
      move.write(t, DOC, text),
      move.interview({ question: done ? 'Thank you, that is all.' : QUESTIONS[t.inputs.length - 1] ?? 'Anything else?', done, document: DOC }),
      move.say(done ? 'Thank you.' : QUESTIONS[t.inputs.length - 1] ?? 'Anything else?'),
    ];
  });

  await step(0, async () => {
    // The search types what is heard as it is heard; a stretch closed by "go" stays, one cancelled goes, and the words
    // after the last stretch join it when the mic stops
    await app.go(`/explorer?ws=${WS}`);
    const search = field('Search or ask a question');
    await listen();
    voice.hear('books by');
    await expect(search).toHaveValue('books by', { timeout: 15_000 });
    await expect(search).not.toBeEditable();
    voice.say('books by author');
    voice.say('delete everything', 'cancelled');
    voice.hear('and year');
    await expect(search).toHaveValue('books by author and year', { timeout: 15_000 });
    const cleared = voice.cleared;
    voice.hear('and year of publication');
    await app.stopSpeaking();
    await expect(search).toHaveValue('books by author and year of publication', { timeout: 15_000 });
    // Taken off the command stream, so the PC's own microphone never sends them on
    expect(voice.cleared).toBe(cleared + 1);
    await expect(search).toBeEditable();
    await search.fill('');
    expect(await chats()).toEqual([]);
  });

  await step(1, async () => {
    // However many microphones a screen shows, the app holds one control socket: counted inside the app's frame, where
    // Firefox reports its sockets
    await app.frame().page().context().addInitScript(() => {
      // What the page's content security policy refused: nothing the app itself does may be
      const refused: string[] = [];
      (window as unknown as { refused: string[] }).refused = refused;
      document.addEventListener('securitypolicyviolation', (e) =>
        refused.push(`${e.violatedDirective} ${e.blockedURI} at ${e.sourceFile.split('/').pop()}:${e.lineNumber}:${e.columnNumber}`),
      );
      const Native = window.WebSocket;
      const controls: WebSocket[] = [];
      (window as unknown as { voiceControls: WebSocket[] }).voiceControls = controls;
      window.WebSocket = class extends Native {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          if (/\/voice\?client=/.test(String(url))) controls.push(this);
        }
      };
    });
    const sockets = () =>
      app.frame().evaluate(() => (window as unknown as { voiceControls?: WebSocket[] }).voiceControls?.map((s) => s.readyState === WebSocket.OPEN) ?? null);
    // The wide explorer with an entity open shows the search's microphone, and none on the entity
    await app.go(`/explorer?ws=${WS}&path=${encodeURIComponent(API)}`);
    await expect(app.text(/Books API|books/i).first()).toBeVisible({ timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 2000));
    expect(await sockets(), 'the control sockets the explorer opened, open or not').toEqual([true]);
    await app.go(`/chat?ws=${WS}&compose=1`);
    await listen();
    await app.stopSpeaking();
    await new Promise((r) => setTimeout(r, 2000));
    expect(await sockets(), 'the control sockets the chat screen opened, open or not').toEqual([true]);
    expect(await app.frame().evaluate(() => (window as unknown as { refused?: string[] }).refused), 'what the page refused to load').toEqual([]);
    // Nothing said goes anywhere by itself: the field holds it until it is sent
    const ask = `Ask ${WS}`;
    await listen();
    voice.hear('which routes are there');
    await expect(field(ask)).toHaveValue('which routes are there', { timeout: 15_000 });
    await app.stopSpeaking();
    await new Promise((r) => setTimeout(r, 3000));
    expect(await chats()).toEqual([]);
    // Edited after the mic stopped, then sent
    await field(ask).pressSequentially('?');
    let since = new Date();
    await field(ask).press('Enter');
    const chat = await newest(since);
    expect((await api.run(chat.id)).messages[0]!.text).toBe('which routes are there?');
    await api.runEnded(chat.id, 2 * 60_000);
    await app.go(`/chat/${chat.id}`);
    since = new Date();
    await dictate('Message', 'and which one deletes a book');
    await until('the follow-up in the same chat', async () => (await api.run(chat.id)).messages.filter((m) => m.role === 'user').length === 2, 60_000);
    expect((await api.run(chat.id)).messages.filter((m) => m.role === 'user').at(-1)!.text).toBe('and which one deletes a book');
    expect((await chats()).filter((r) => r.created_at >= since)).toHaveLength(0);
  });

  const interview = await step(2, async () => {
    // "Interview <topic>" sent as a new chat starts an interview
    await app.go(`/chat?ws=${WS}&compose=1`);
    const since = new Date();
    const chatsBefore = (await chats()).length;
    await dictate(`Ask ${WS}`, 'interview reading habits');
    const run = await until('the interview', async () => (await api.runs(WS, 'interview')).find((r) => r.created_at >= since), 60_000);
    expect(await chats()).toHaveLength(chatsBefore);
    // A turn is over once the interviewer has answered the person's nth message with its next question
    const turn = async (n: number) => {
      const r = await api.answered(run.id, n, 10 * 60_000);
      expect(r.status).toBe('finished');
      expect(r.interview!.done).toBe(false);
      expect(r.interview!.question.trim()).toMatch(/\?$/);
      return r.interview!;
    };
    const first = await turn(1);
    const doc = first.document;
    expect(doc).toMatch(/^interviews\/.+\.md$/);
    const text = () => env.show(WS, doc) ?? '';
    await app.go(`/chat/${run.id}`);

    // An answer is written into the document, and the next question moves on
    await dictate('Answer', 'about two a month');
    const second = await turn(2);
    expect(text()).toMatch(/\b(two|2)\b/i);
    expect(text()).toMatch(/month/i);
    expect(second.question).not.toBe(first.question);

    // A skip writes nothing and asks something else
    const kept = text();
    await dictate('Answer', 'skip');
    const third = await turn(3);
    expect(text()).toBe(kept);
    expect(third.question).not.toBe(second.question);

    // A question back, said after "question", is answered, the document left as it was, and the interview asks again
    await dictate('Answer', 'why do you ask', 'question');
    await turn(4);
    const r = await api.run(run.id);
    expect(r.messages.some((m) => m.role === 'user' && m.text === 'Question: why do you ask')).toBe(true);
    expect(text()).toBe(kept);
    // One document all along
    expect(r.interview!.document).toBe(doc);
    // Not summarized while it goes on
    expect((await env.sql<{ n: number }[]>`select count(*)::int as n from ${env.sql('ws_bookshelf_api.entity_artifact')} where artifact_path = ${doc}`)[0]!.n).toBe(0);
    return { id: run.id, doc };
  });

  await step(3, async () => {
    await dictate('Answer', 'stop interview');
    const r = await until('the interview done', async () => {
      const x = await api.run(interview.id);
      return x.interview?.done && x.status !== 'running' && x.status !== 'queued' ? x : null;
    }, 10 * 60_000);
    expect(r.status).toBe('finished');
    // Its document is summarized by the interview itself into entities waiting in the feed
    const over = await until('the summary', async () => {
      const rows = await env.sql<{ entity_path: string }[]>`select entity_path from ${env.sql('ws_bookshelf_api.entity_artifact')} where artifact_path = ${interview.doc}`;
      return rows.length ? rows.map((x) => x.entity_path) : null;
    }, 60_000);
    for (const path of over) expect((await api.entity(WS, path)).verification).toBe('unverified');
    expect(graphIssues(env, WS)).toEqual([]);
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
