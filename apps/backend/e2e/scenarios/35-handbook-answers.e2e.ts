import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { typeInto } from '../support/app.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entitiesOf } from '../support/landed.ts';
import { move } from '../support/scripted.ts';

const WS = 'handbook';
const LEAVE = 'Governance/Policy/leave-policy';
const FAQ = 'Knowledge/Faq/bike-to-work';
const kg = (p: string) => `knowledge-graph/${p}.md`;

// The user looks things up in their handbook and fills in what it does not answer
scenario('handbook-answers', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  /** The FAQ the chat filed, as it named it */
  let faq = '';
  model.on('answers from the handbook', (t) => t.automation === 'chat' && (t.kind === 'prompt' || t.kind === 'message') && /holiday|carry over/i.test(t.input), (t) => [
    move.say(/carry over/i.test(t.input) ? 'Up to 5 unused days carry over; they expire on 31 March.' : 'Full-time staff get 26 days of paid holiday a year, plus public holidays.'),
  ]);
  model.on('an unanswered question becomes a FAQ', (t) => t.automation === 'chat' && t.kind === 'prompt' && /bike/i.test(t.input) && !t.target, (t) => [
    move.entity(t, FAQ, { type: 'Knowledge/Faq', origin: 'requested', title: 'Is there a bike-to-work scheme?', card: 'Not answered in the handbook yet.', references: [{ to: 'Product/Product/handbook', relation: 'part_of' }] }),
    move.say('The handbook does not say; I filed it as an open question.'),
  ]);
  model.on('the user answers it', (t) => t.automation === 'chat' && t.target === faq && t.kind === 'prompt', (t) => [
    move.entity(t, FAQ, { type: 'Knowledge/Faq', origin: 'requested', title: 'Is there a bike-to-work scheme?', card: 'Yes: up to 1,000 EUR towards a bike through payroll, once every three years.', references: [{ to: 'Product/Product/handbook', relation: 'part_of' }] }),
    move.say('Answered.'),
  ]);

  await step(0, async () => {
    await app.go(`/explorer?ws=${WS}`);
    await typeInto(app.frame().getByPlaceholder('Search or ask a question'), 'holiday');
    await expect(app.text('Leave policy')).toBeVisible({ timeout: 15_000 });
    await app.text('Leave policy').click();
    // The artifacts are folded until opened
    await app.frame().getByRole('button', { name: /Artifacts/ }).click({ timeout: 15_000 });
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
    expect((await api.runEnded(runId, 10 * 60_000)).status).toBe('finished');
    // Answered from the policy, and shown in the conversation
    expect(await api.answer(runId)).toMatch(/\b26 days\b/);
    await app.go(`/chat/${runId}`);
    await expect(app.text(/26 days/, false).first()).toBeVisible({ timeout: 15_000 });
    await app.reply(runId, 'Can unused days carry over?');
    expect((await api.answered(runId, 2, 10 * 60_000)).status).toBe('finished');
    expect(await api.answer(runId)).toMatch(/31(st)? March|March 31/);
    // The card added to the first question stays with the chat
    expect((await api.run(runId)).messages[0]!.context.map((c) => c.path)).toEqual([LEAVE]);
  });

  await step(2, async () => {
    const chat = await app.chat(WS, 'Is there a bike-to-work scheme? If the handbook does not say, file the question as a Knowledge/Faq for me to answer.');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    const filed = (await entitiesOf(env, WS, chat)).filter((p) => p.startsWith('Knowledge/Faq/'));
    expect(filed, 'the question filed as a FAQ').toHaveLength(1);
    faq = filed[0]!;
    expect((await api.entity(WS, faq)).title).toMatch(/bike|bicycle|cycl/i);
    await until('the question in the feed', async () => (await api.feed()).items.some((i) => i.path === faq));
    const answer = await app.sendBack(WS, faq, 'Yes: up to 1,000 EUR towards a bike through payroll, once every three years.');
    expect((await api.runEnded(answer, 10 * 60_000)).status).toBe('finished');
    await until('the answer in the feed', async () => (await api.feed()).items.some((i) => i.path === faq));
    await app.approve(WS, faq);
    expect((await api.entity(WS, faq)).markdown).toMatch(/1[,. ]?000\s*EUR|EUR\s*1[,. ]?000|€\s*1[,. ]?000/);
  });

  await step(3, async () => {
    // Asked again later: the search finds the answer
    const { results } = await api.call<{ results: { path: string }[] }>('GET', `/workspaces/${WS}/search?q=${encodeURIComponent('bicycle')}`);
    expect(results.slice(0, 3).map((r) => r.path)).toContain(faq);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=user`);
    const approved = events.find((e) => e.kind === 'approved' && e.path === faq);
    expect(approved, 'the approval on the timeline').toBeTruthy();
    // The row's check already says it was approved: the line names only what was
    const what = approved!.title.replace(/^Approved\s+“?(.*?)”?$/, '$1');
    await app.tab('Timeline');
    await expect(app.frame().getByText(what, { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
    expect(env.show(WS, kg(faq))).toContain('verification: verified');
  });
});
