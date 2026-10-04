import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const ANSWER = 'GET /books lists every book, GET /books/:id reads one, POST /books creates one.';

// Real Claude Code runs and harness; the model's side is scripted
scenario('conversations', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  const said = async (runId: string) => (await api.run(runId)).messages.filter((m) => m.role === 'assistant').map((m) => m.text);

  model.on('answers questions', { automation: 'chat', kind: 'prompt' }, (t) => (/routes/i.test(t.input) ? [move.say(ANSWER)] : undefined));
  model.on('answers follow-ups', { automation: 'chat', kind: 'message' }, (t) => (/creates/i.test(t.input) ? [move.say('POST /books.')] : undefined));
  // Summarization, as the sub-agent would: one chat entity over the transcript
  model.on('summarizes chats', { automation: 'chat', kind: 'summarize' }, (t) => {
    const transcript = /- (chats\/\w+\.jsonl)/.exec(t.input)?.[1];
    if (!transcript) return undefined;
    return [
      move.entity(t, `Harness/Chat/${t.run}`, {
        type: 'Harness/Chat',
        title: 'Routes of the books API',
        card: 'The user asked which routes the API has and which one creates a book: `POST /books`.',
        artifacts: [transcript],
        references: [{ to: API, relation: 'concerns' }],
      }),
      move.say('Summarized.'),
    ];
  });

  const runId = await step(0, async () => {
    const { title } = await api.entity(WS, API);
    const { runId } = await api.call<{ runId: string }>('POST', `/workspaces/${WS}/chats`, {
      text: 'Which routes does this API have?',
      context: [{ workspace: WS, path: API, title, heading: [], quote: 'An empty title still passes the check.' }],
    });
    await app.go(`/chat/${runId}`);
    expect((await api.runEnded(runId, 5 * 60_000)).status).toBe('finished');
    await expect(app.text(ANSWER, false)).toBeVisible({ timeout: 30_000 });
    // The agent got the card part ahead of the question
    const first = model.turns(runId).find((t) => t.kind === 'prompt')!;
    expect(first.input).toContain(`knowledge-graph/${API}.md >`);
    expect(first.input).toContain('An empty title still passes the check.');
    expect((await api.run(runId)).messages[0]!.context.map((c) => c.path)).toEqual([API]);

    // Asked in the Chat tab, as the user types it
    const typed = await app.chat(WS, 'And which routes read a single book?');
    expect((await api.runEnded(typed, 5 * 60_000)).status).toBe('finished');
    return runId;
  });

  await step(1, async () => {
    await app.reply(runId, 'Which of them creates a book?');
    await until('the chat to answer again', async () => (await said(runId)).includes('POST /books.') && (await api.run(runId)).status === 'finished', 5 * 60_000);
    // One run, two turns: no second chat was started
    expect((await api.run(runId)).messages.filter((m) => m.role === 'user')).toHaveLength(2);
    const summary = `Harness/Chat/${runId}`;
    await until('the chat entity', async () => (await api.entities(WS, 'Harness/Chat')).some((e) => e.path === summary), 2 * 60_000);
    expect((await api.entity(WS, summary)).artifacts.map((a) => a.path)).toContain(`chats/${runId}.jsonl`);
    const listed = await until('the chat linked to its entity', async () =>
      (await api.call<{ chats: { runId: string; entityPath: string | null }[] }>('GET', `/workspaces/${WS}/chats`)).chats.find((c) => c.runId === runId && c.entityPath));
    expect(listed.entityPath).toBe(summary);
    await app.tab('Chat');
    await expect(app.text('Which routes does this API have?', false)).toBeVisible();
    // The chat summarized its own transcript: no summarization run follows for it, and nothing is left updating
    await new Promise((r) => setTimeout(r, 8000));
    expect(await api.runs(WS, 'summarization')).toEqual([]);
    expect((await api.entities(WS)).filter((e) => e.sync === 'updating' || e.sync === 'artifact_ahead').map((e) => e.path)).toEqual([]);
  });

  await step(2, async () => {
    const changed = entityText({
      type: 'Architecture/Api',
      origin: 'user',
      title: 'Books API',
      card: env.show(WS, `knowledge-graph/${API}.md`)!.split('# Books API')[1]!.replace('An empty title still passes the check.', 'An empty title is refused with 400.').trim(),
      impact: [3, 1, 2],
      references: [
        { to: 'Architecture/Component/book-store', relation: 'depends_on' },
        { to: 'Product/Product/bookshelf', relation: 'part_of' },
        { to: 'Governance/DesignDoc/design', relation: 'implements' },
      ],
      artifacts: ['src/server.js'],
    });
    model.on('changes the card', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.target === API, (t) => [
      move.write(t, `knowledge-graph/${API}.md`, changed),
      move.say('The card now says an empty title is refused.'),
    ]);
    const chat = await app.chat(WS, 'The API refuses empty titles now; say so on the card.');
    await api.call('GET', `/runs/${chat}`);
    // Started from the entity, as the entity page's composer does
    const { runId: onEntity } = await api.chat(WS, 'The API refuses empty titles now; say so on the card.', API);
    for (const id of [chat, onEntity]) expect((await api.runEnded(id, 5 * 60_000)).status).toBe('finished');
    expect(env.show(WS, `knowledge-graph/${API}.md`)).toContain('An empty title is refused with 400.');
    const item = await until('the changed card in the feed with its diff', async () => (await api.feed()).items.find((i) => i.path === API && i.diff));
    expect(item.verification).toBe('unverified');
    await app.approve(WS, API);
    const after = await api.entity(WS, API);
    expect(after.verification).toBe('verified');
    expect(after.sync).toBe('synced');
    expect((await api.feed()).items.some((i) => i.path === API)).toBe(false);
  });

  await step(3, async () => {
    model.on('fails', { automation: 'chat', kind: 'prompt' }, (t) => (/broken/i.test(t.input) && !/again/i.test(t.input) ? [move.error(400, 'Scripted: the request was refused')] : undefined));
    model.on('recovers', { automation: 'chat' }, (t) => (/again/i.test(t.input) ? [move.say('Back again.')] : undefined));
    const chat = await app.chat(WS, 'This question meets a broken API.');
    const failed = await api.runEnded(chat, 5 * 60_000);
    expect(failed.status).toBe('failed');
    expect(failed.error).toBeTruthy();
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=100`);
    expect(events.find((e) => e.runId === chat && e.kind === 'run_failed')?.detail).toBeTruthy();
    await app.reply(chat, 'Try again please.');
    await until('the chat to answer after the failure', async () => (await said(chat)).includes('Back again.') && (await api.run(chat)).status === 'finished', 5 * 60_000);
  });

  await step(4, async () => {
    const triggers = (await api.feed()).items.filter((i) => i.type === 'Harness/Trigger');
    const [a, b] = triggers;
    const commits = Number(env.git(WS, 'rev-list', '--count', 'main'));
    // The phone and the laptop both swipe the same card
    const approve = () => api.call('POST', `/feed/${encodeURIComponent(a!.path)}/approve`, { workspace: WS, timeSpentMs: 1000 });
    const results = await Promise.allSettled([approve(), approve()]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(Number(env.git(WS, 'rev-list', '--count', 'main'))).toBe(commits + 1);
    const reactions = await env.sql<{ n: number }[]>`select count(*)::int as n from ${env.sql('ws_bookshelf_api.attention_metric')} where entity_path = ${a!.path}`;
    expect(reactions[0]!.n).toBe(1);

    const sendBack = () => api.call<{ runId: string }>('POST', `/feed/${encodeURIComponent(b!.path)}/send-back`, { workspace: WS, comment: 'Only on demand.', timeSpentMs: 1000 });
    const sent = await Promise.allSettled([sendBack(), sendBack()]);
    const runs = new Set(sent.flatMap((r) => (r.status === 'fulfilled' ? [r.value.runId] : [])));
    expect(runs.size).toBe(1);
    expect((await api.runs(WS, 'chat')).filter((r) => r.target_path === b!.path)).toHaveLength(1);
  });
});
