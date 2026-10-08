import type { MetricsResponse, TimelineResponse } from '@momentum/contract';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { REPO } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const ANSWER = 'GET /books lists every book, GET /books/:id reads one, POST /books creates one.';
/** The routes of src/server.js, however an answer words them */
const ROUTES = [/GET\W+\/books\b/, /\/books\/:id/, /POST\W+\/books\b/];
const UNKNOWN = 'Say on the card that any other route answers 404 with the error "not found".';
const MISSING = 'Also say that a missing book answers 404 with the error "book not found".';

// Real Claude Code runs and harness; the model's side is scripted, or the real model's live
scenario('conversations', { enabled: [WS] }, async ({ env, api, app, model, step }) => {

  // Retrieval with two tools side by side in one reply, then the answer from what they found
  model.on('answers questions', { automation: 'chat', kind: 'prompt' }, (t) =>
    /routes/i.test(t.input)
      ? [
          move.parallel(
            { tool: 'mcp__momentum-kb__search', input: { query: 'books API routes' } },
            { tool: 'Grep', input: { pattern: 'books', path: 'src' } },
          ),
          move.say(ANSWER),
        ]
      : undefined,
  );
  model.on('answers follow-ups', { automation: 'chat', kind: 'message' }, (t) => (/creates/i.test(t.input) ? [move.say('POST /books.')] : undefined));
  const runId = await step(0, async () => {
    const { title } = await api.entity(WS, API);
    const { runId } = await api.call<{ runId: string }>('POST', `/workspaces/${WS}/chats`, {
      text: 'Which routes does this API have?',
      context: [{ workspace: WS, path: API, title, heading: [], quote: 'An empty title still passes the check.' }],
    });
    await app.go(`/chat/${runId}`);
    expect((await api.runEnded(runId, 5 * 60_000)).status).toBe('finished');
    // Answered from the code: every route, and the answer shows in the conversation
    const answer = await api.answer(runId);
    for (const route of ROUTES) expect(answer).toMatch(route);
    await expect(app.text(/\/books\/:id/, false).first()).toBeVisible({ timeout: 30_000 });
    // The agent got the card part ahead of the question
    const first = model.turns(runId).find((t) => t.kind === 'prompt')!;
    expect(first.input).toContain(`knowledge-graph/${API}.md >`);
    expect(first.input).toContain('An empty title still passes the check.');
    expect((await api.run(runId)).messages[0]!.context.map((c) => c.path)).toEqual([API]);

    // What the agent did shows under the question; once the run ends its retrieval is rated, each tool against the other
    const rated = await until('the retrieval rated', async () => (await api.run(runId)).turns.find((t) => t.retrievalState === 'rated') ?? null, 2 * 60_000);
    expect(rated.endedAt).not.toBeNull();
    if (!model.live) {
      expect(rated.steps.filter((s) => !s.bookkeeping).map((s) => s.name)).toEqual(['momentum-kb · search', 'Grep']);
      expect(rated.retrieval!.parallel).toBe(true);
      expect(rated.retrieval!.tools.map((t) => [t.tool, t.relative])).toEqual([['momentum-kb · search', 1], ['Grep', 0.6]]);
    }
    const worked = app.text(/^Worked \d+:\d\d · /, false).first();
    await expect(worked).toBeVisible({ timeout: 30_000 });
    await expect(app.text(/RAG \d+%/, false).first()).toBeVisible({ timeout: 30_000 });
    await worked.click();
    await expect(app.text(/^Retrieval \d+% · precision/, false).first()).toBeVisible();
    // The metrics rate each retrieval tool against the others, over the range and over time
    const metrics = await api.call<MetricsResponse>('GET', `/workspaces/${WS}/metrics?range=24h`);
    expect(metrics.retrieval.turns.value).toBeGreaterThanOrEqual(1);
    expect(metrics.retrieval.tools.map((t) => t.tool)).toEqual(expect.arrayContaining(['momentum-kb · search', 'Grep']));
    expect(metrics.retrieval.tools.every((t) => t.series.some((p) => p.value !== null))).toBe(true);
    await app.tab('Metrics');
    await expect(app.text('Retrieval')).toBeVisible({ timeout: 30_000 });
    await expect(app.text('RAG score', false).first()).toBeVisible();
    await expect(app.text('momentum-kb · search', false).first()).toBeVisible();
    // The panel's title comes after the chart's picker row of the same name
    await expect(app.text(/^\d+ rated turns?, last /, false).first()).toBeVisible();
    const panel = app.frame().getByText('Retrieval', { exact: true }).last().locator('..');
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: join(REPO, 'test-results', 'retrieval-metrics.png') });
    await app.text('Tool relevance, relative').click();
    const chart = app.frame().getByText('Over time', { exact: true }).first().locator('..');
    await chart.scrollIntoViewIfNeeded();
    await expect(app.text(/Retrieval · Tool relevance, relative/, false).first()).toBeVisible();
    await chart.screenshot({ path: join(REPO, 'test-results', 'retrieval-tools-chart.png') });

    // Asked in the Chat tab, as the user types it
    const typed = await app.chat(WS, 'And which routes read a single book?');
    expect((await api.runEnded(typed, 5 * 60_000)).status).toBe('finished');
    return runId;
  });

  await step(1, async () => {
    await app.reply(runId, 'Which of them creates a book?');
    expect((await api.answered(runId, 2)).status).toBe('finished');
    expect(await api.answer(runId)).toMatch(/POST\W+\/books\b/);
    // One run, two turns: no second chat was started
    expect((await api.run(runId)).messages.filter((m) => m.role === 'user')).toHaveLength(2);
    // A transcript is never summarized: no entity is written over it, in the run or after it
    await until('the transcript on the main line', async () => env.show(WS, `chats/${runId}.jsonl`) !== null, 2 * 60_000);
    expect(model.turns(runId).some((t) => t.kind === 'summarize')).toBe(false);
    expect(await api.entities(WS, 'Harness/Chat')).toEqual([]);
    await app.tab('Chat');
    await expect(app.text('Which routes does this API have?', false)).toBeVisible();
    // No summarization run follows for the transcript either, and nothing is left updating
    await new Promise((r) => setTimeout(r, 8000));
    expect(await api.runs(WS, 'summarization')).toEqual([]);
    expect((await api.entities(WS)).filter((e) => e.sync === 'updating' || e.sync === 'artifact_ahead').map((e) => e.path)).toEqual([]);
  });

  await step(2, async () => {
    // Two facts src/server.js bears out, which the card does not say yet
    const card = (extra: string[]) =>
      entityText({
        type: 'Architecture/Api',
        origin: 'user',
        title: 'Books API',
        card: [env.show(WS, `knowledge-graph/${API}.md`)!.split('# Books API')[1]!.trim(), ...extra].join('\n\n'),
        impact: [3, 1, 2],
        references: [
          { to: 'Architecture/Component/book-store', relation: 'depends_on' },
          { to: 'Product/Product/bookshelf', relation: 'part_of' },
          { to: 'Governance/DesignDoc/design', relation: 'implements' },
        ],
        artifacts: ['src/server.js'],
      });
    model.on('changes the card', (t) => t.automation === 'chat' && t.kind === 'prompt' && /other route/.test(t.input), (t) => [
      move.write(t, `knowledge-graph/${API}.md`, card(['Any other route answers 404 with the error "not found".'])),
      move.say('The card now says what other routes answer.'),
    ]);
    model.on('changes the card from its page', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.target === API, (t) => [
      move.write(t, `knowledge-graph/${API}.md`, card(['A missing book answers 404 with the error "book not found".'])),
      move.say('The card now says what a missing book answers.'),
    ]);
    const chat = await app.chat(WS, UNKNOWN);
    expect((await api.runEnded(chat, 5 * 60_000)).status).toBe('finished');
    expect(env.show(WS, `knowledge-graph/${API}.md`)).toMatch(/not found/);
    // Started from the entity, as the entity page's composer does
    const { runId: onEntity } = await api.chat(WS, MISSING, API);
    const second = await api.runEnded(onEntity, 5 * 60_000);
    expect(second.status).toBe('finished');
    expect(second.targetPath).toBe(API);
    const markdown = env.show(WS, `knowledge-graph/${API}.md`)!;
    expect(markdown).toContain('book not found');
    // Still the same entity, over the same artifact and references
    expect(markdown).toContain('src/server.js');
    expect(markdown).toContain('Architecture/Component/book-store');
    const item = await until('the changed card in the feed with its diff', async () => (await api.feed()).items.find((i) => i.path === API && i.diff));
    expect(item.verification).toBe('unverified');
    expect((await api.feed()).items.filter((i) => i.type === 'Harness/Conflict')).toEqual([]);
    await app.approve(WS, API);
    const after = await api.entity(WS, API);
    expect(after.verification).toBe('verified');
    expect(after.sync).toBe('synced');
    expect((await api.feed()).items.some((i) => i.path === API)).toBe(false);
  });

  await step(3, async () => {
    // The API refuses the question's first request: an outage, injected at the network, live too
    model.on('fails', { automation: 'chat', kind: 'prompt' }, (t) => (/missing book/i.test(t.input) ? [move.error(400, 'Injected: the request was refused')] : undefined));
    model.on('recovers', { automation: 'chat' }, (t) => (/again/i.test(t.input) ? [move.say('A missing book answers 404.')] : undefined));
    const chat = await app.chat(WS, 'What does GET /books/:id answer for a missing book?');
    const failed = await api.runEnded(chat, 5 * 60_000);
    expect(failed.status).toBe('failed');
    expect(failed.error).toBeTruthy();
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=100`);
    expect(events.find((e) => e.runId === chat && e.kind === 'run_failed')?.detail).toBeTruthy();
    await app.reply(chat, 'Try again please.');
    expect((await api.answered(chat, 2)).status).toBe('finished');
    // The session resumed: the answer is to the first question
    expect(await api.answer(chat)).toMatch(/404/);
  });

  await step(4, async () => {
    const triggers = (await api.feed()).items.filter((i) => i.type === 'Harness/Trigger');
    const [a, b] = triggers;
    const commits = Number(env.git(WS, 'rev-list', '--count', 'main'));
    // The user swipes the same card on the phone and on the laptop
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
