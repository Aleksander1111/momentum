import { existsSync } from 'node:fs';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const TRIGGER = 'Harness/Trigger/exploration';

scenario('chat-and-send-back', { enabled: [WS] }, async ({ env, api, app, step }) => {
  const said = async (runId: string) => (await api.run(runId)).messages.filter((m) => m.role === 'assistant').map((m) => m.text).join('\n');

  const runId = await step(0, async () => {
    const { title } = await api.entity(WS, API);
    const { runId } = await api.call<{ runId: string }>('POST', `/workspaces/${WS}/chats`, {
      text: 'Which routes does this API have? Answer in at most three short lines.',
      context: [{ workspace: WS, path: API, title, heading: [] }],
    });
    await app.go(`/chat/${runId}`);
    expect((await api.runEnded(runId)).status).toBe('finished');
    const run = await api.run(runId);
    expect(run.messages[0]!.context.map((c) => c.path)).toEqual([API]);
    expect(await said(runId)).toMatch(/\/books/);
    return runId;
  });

  await step(1, async () => {
    await app.reply(runId, 'Which of them creates a book? One line.');
    await until('the chat to answer again', async () => (await api.run(runId)).messages.filter((m) => m.role === 'assistant').length >= 2 && (await api.run(runId)).status === 'finished', 15 * 60_000);
    expect(await said(runId)).toMatch(/POST/);
    // The transcript lands on the main line for the optimization to read; nothing summarizes it
    await until('the transcript on the main line', async () => env.show(WS, `chats/${runId}.jsonl`) !== null, 15 * 60_000);
    expect(await api.entities(WS, 'Harness/Chat')).toEqual([]);
  });

  await step(2, async () => {
    const chat = await app.sendBack(WS, TRIGGER, 'Run it every 6 hours instead of every 2 hours.');
    expect((await api.runEnded(chat)).status).toBe('finished');
    await until('the trigger changed', async () => /^schedule: "?0 \*\/6 \* \* \*"?$/m.test(env.show(WS, `knowledge-graph/${TRIGGER}.md`) ?? ''));
    expect((await api.entity(WS, TRIGGER)).verification).toBe('unverified');
    const item = (await api.feed()).items.find((i) => i.path === TRIGGER);
    expect(item).toBeDefined();
    await app.go('/feed');
  });

  await step(3, async () => {
    const chat = await app.chat(WS, 'Write a short plan for adding search by author to the API. Do not implement it.');
    expect((await api.runEnded(chat)).status).toBe('finished');
    const plans = env.files(WS, 'plans');
    expect(plans.length).toBeGreaterThan(0);
    const plan = await until('the plan entity', async () => {
      const rows = await api.entities(WS, 'Harness/Plan');
      return rows[0] ?? null;
    }, 15 * 60_000);
    expect((await api.entity(WS, plan.path)).artifacts.map((a) => a.path)).toEqual(expect.arrayContaining([plans[0]]));
  });

  await step(4, async () => {
    const chat = await app.chat(WS, 'Write a detailed design document for search in docs/search.md, at least 80 lines.');
    await until('the chat to run', async () => (await api.run(chat)).status === 'running');
    await new Promise((r) => setTimeout(r, 5000));
    await api.mcp('kill_run', { id: chat });
    const r = await api.runEnded(chat);
    expect(r.status).toBe('killed');
    expect(existsSync(r.checkout)).toBe(false);
    // Whatever it wrote before it was killed landed on the main line
    const [t] = await env.sql<{ run_id: string }[]>`select run_id from ${env.sql('ws_bookshelf_api.transaction')} where run_id = ${chat}`;
    expect(t?.run_id).toBe(chat);
  });
});
