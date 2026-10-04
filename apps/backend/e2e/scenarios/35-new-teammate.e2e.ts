import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'handbook';
const LEAVE = 'Governance/Policy/leave-policy';
const FAQ = 'Knowledge/Faq/bike-to-work';
const kg = (p: string) => `knowledge-graph/${p}.md`;

// A new teammate finds their way around the handbook in their first week
scenario('new-teammate', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  model.on('answers from the handbook', (t) => t.automation === 'chat' && (t.kind === 'prompt' || t.kind === 'message') && /holiday|carry over/i.test(t.input), (t) => [
    move.say(/carry over/i.test(t.input) ? 'Up to 5 unused days carry over; they expire on 31 March.' : 'Full-time staff get 26 days of paid holiday a year, plus public holidays.'),
  ]);
  model.on('an unanswered question becomes a FAQ', (t) => t.automation === 'chat' && t.kind === 'prompt' && /bike/i.test(t.input) && !t.target, (t) => [
    move.entity(t, FAQ, { type: 'Knowledge/Faq', origin: 'requested', title: 'Is there a bike-to-work scheme?', card: 'Not answered in the handbook yet.', references: [{ to: 'Product/Product/handbook', relation: 'part_of' }] }),
    move.say('The handbook does not say; I filed it as a question for People Ops.'),
  ]);
  model.on('People Ops answers it', (t) => t.automation === 'chat' && t.target === FAQ && t.kind === 'prompt', (t) => [
    move.entity(t, FAQ, { type: 'Knowledge/Faq', origin: 'requested', title: 'Is there a bike-to-work scheme?', card: 'Yes: up to 1,000 EUR towards a bike through payroll, once every three years.', references: [{ to: 'Product/Product/handbook', relation: 'part_of' }] }),
    move.say('Answered.'),
  ]);

  await step(0, async () => {
    await app.go(`/explorer?ws=${WS}`);
    await app.frame().getByPlaceholder('Search entities').fill('holiday');
    await expect(app.text('Leave policy')).toBeVisible({ timeout: 15_000 });
    await app.text('Leave policy').click();
    await expect(app.text('docs/leave-policy.md', false)).toBeVisible({ timeout: 15_000 });
    // By meaning, not only by the words: "time off" finds the leave policy
    const { results } = await api.call<{ results: { path: string }[] }>('GET', `/workspaces/${WS}/search?q=${encodeURIComponent('time off')}`);
    expect(results.slice(0, 3).map((r) => r.path)).toContain(LEAVE);
    expect((await api.call<{ path: string; text: string }>('GET', `/workspaces/${WS}/artifact/docs/leave-policy.md`)).text).toContain('26 days of paid holiday');
  });

  await step(1, async () => {
    const { title } = await api.entity(WS, LEAVE);
    const { runId } = await api.call<{ runId: string }>('POST', `/workspaces/${WS}/chats`, {
      text: 'How many holiday days do I get?',
      context: [{ workspace: WS, path: LEAVE, title, heading: [] }],
    });
    expect((await api.runEnded(runId, 2 * 60_000)).status).toBe('finished');
    await app.go(`/chat/${runId}`);
    await expect(app.text('26 days of paid holiday', false)).toBeVisible({ timeout: 15_000 });
    await app.reply(runId, 'Can unused days carry over?');
    await until('the follow-up answered', async () => (await api.run(runId)).messages.some((m) => m.role === 'assistant' && m.text.includes('31 March')) && (await api.run(runId)).status === 'finished', 2 * 60_000);
    // The card added to the first question stays with the chat
    expect((await api.run(runId)).messages[0]!.context.map((c) => c.path)).toEqual([LEAVE]);
  });

  await step(2, async () => {
    const chat = await app.chat(WS, 'Is there a bike-to-work scheme?');
    expect((await api.runEnded(chat, 2 * 60_000)).status).toBe('finished');
    await until('the question in the feed', async () => (await api.feed()).items.some((i) => i.path === FAQ));
    const answer = await app.sendBack(WS, FAQ, 'Yes: up to 1,000 EUR towards a bike through payroll, once every three years.');
    expect((await api.runEnded(answer, 2 * 60_000)).status).toBe('finished');
    await until('the answer in the feed', async () => (await api.feed()).items.some((i) => i.path === FAQ));
    await app.approve(WS, FAQ);
    expect((await api.entity(WS, FAQ)).markdown).toContain('1,000 EUR');
  });

  await step(3, async () => {
    // Next week someone asks the same: the search finds the answer
    const { results } = await api.call<{ results: { path: string }[] }>('GET', `/workspaces/${WS}/search?q=${encodeURIComponent('bicycle')}`);
    expect(results.slice(0, 3).map((r) => r.path)).toContain(FAQ);
    await app.tab('Timeline');
    await expect(app.text('Approved', false)).toBeVisible({ timeout: 15_000 });
    expect(env.show(WS, kg(FAQ))).toContain('verification: verified');
  });
});
