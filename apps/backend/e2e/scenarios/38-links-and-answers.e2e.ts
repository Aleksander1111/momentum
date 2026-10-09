import { until } from '../support/api.ts';
import { typeInto } from '../support/app.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'handbook';
const HARNESS = 'momentum';
const LEAVE = 'Governance/Policy/leave-policy';
const CARRY = 'Knowledge/Faq/carry-over';

/** A FAQ that links the leave policy in its text, and references it as it must */
const carryOver = `---
type: Knowledge/Faq
origin: user
verification: verified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references:
  - to: ${LEAVE}
    relation: based_on
artifacts: []
---
# Can unused holiday carry over?

Yes: up to 5 days, until 31 March, as [the leave policy](${LEAVE}) sets out.
`;

// The user follows entities from wherever they are named, and asks the graph instead of searching it
scenario('links-and-answers', { enabled: [WS, HARNESS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  // Screens stay mounted under the one on top: only what is shown counts
  const seen = (text: string | RegExp, exact = true) => app.frame().getByText(text, { exact }).locator('visible=true').first();
  model.on('a chat answer naming an entity', { automation: 'chat', kind: 'prompt' }, () => [
    move.say(`Holiday is in [the leave policy](${LEAVE}); the carry-over rule is \`${CARRY}\`.`),
  ]);

  await step(0, async () => {
    env.commit(WS, { [`knowledge-graph/${CARRY}.md`]: carryOver }, 'Answer the carry-over question');
    await until('the FAQ indexed', async () => (await api.entity(WS, CARRY).catch(() => null)) !== null);
    await app.entity(WS, LEAVE);
    const f = app.frame();
    await expect(f.getByText('Leave policy', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
    // Folded: their headings show, what they hold does not
    const references = f.getByRole('button', { name: /References/ });
    const artifacts = f.getByRole('button', { name: /Artifacts/ });
    await expect(references).toBeVisible();
    await expect(artifacts).toBeVisible();
    await expect(seen('docs/leave-policy.md')).toHaveCount(0);
    await expect(seen('Can unused holiday carry over?')).toHaveCount(0);
    await artifacts.click();
    await expect(seen('docs/leave-policy.md')).toBeVisible();
    // Opened, the references group by type, each led by its type's pill, and open on a press
    await references.click();
    await expect(seen('Knowledge · Faq')).toBeVisible();
    await expect(seen('Product · Product')).toBeVisible();
    await f.getByRole('link', { name: 'Can unused holiday carry over?' }).click();
    await expect(f.getByText('Can unused holiday carry over?', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
    await until('the FAQ opened', async () => decodeURIComponent(f.url()).includes(CARRY));
  });

  await step(1, async () => {
    // The link in the FAQ's text reads as the policy and opens it
    await app.entity(WS, CARRY);
    const f = app.frame();
    const link = f.getByRole('link', { name: /the leave policy/ });
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(f.getByText('Leave policy', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
    // A chat answer names entities the same way, by a link or by a path
    const chat = await app.chat(WS, 'Where are the holiday rules, and can unused days carry over?');
    expect((await api.runEnded(chat)).status).toBe('finished');
    await app.go(`/chat/${chat}`);
    // A link under its own label, a path under the entity's title; live, the model words its links itself
    const policy = f.getByRole('link', { name: model.live ? /leave policy/i : /the leave policy/ }).locator('visible=true').first();
    const faq = f.getByRole('link', { name: model.live ? /carry.?over/i : 'Can unused holiday carry over?' }).locator('visible=true').first();
    await expect(policy).toBeVisible({ timeout: 15_000 });
    await expect(faq).toBeVisible({ timeout: 15_000 });
    await faq.click();
    await expect(f.getByText('Can unused holiday carry over?', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
    await until('the FAQ opened from the answer', async () => decodeURIComponent(f.url()).includes(CARRY));
  });

  await step(2, async () => {
    const asked = await api.call<{ question: string; answer: string; sources: { path: string }[] }>('POST', `/workspaces/${WS}/ask`, {
      q: 'How many holiday days do I get?',
    });
    expect(asked.answer.length).toBeGreaterThan(0);
    expect(asked.sources.slice(0, 5).map((s) => s.path)).toContain(LEAVE);
    await app.go(`/explorer?ws=${WS}`);
    const f = app.frame();
    const search = f.getByPlaceholder('Search or ask a question');
    // A question asks itself once typing pauses
    await typeInto(search, 'How many holiday days do I get?');
    const answer = f.getByLabel('Answer', { exact: true });
    await expect(answer).toBeVisible({ timeout: 30_000 });
    await expect(answer.getByText('Ask more in a chat')).toBeVisible({ timeout: 60_000 });
    // Keywords are searched; Enter asks about them
    await typeInto(search, 'carry over');
    await expect(seen('Can unused holiday carry over?')).toBeVisible({ timeout: 15_000 });
    await expect(seen('Ask the graph about “carry over”')).toBeVisible();
    await search.press('Enter');
    await expect(f.getByLabel('Answer', { exact: true }).getByText('Ask more in a chat')).toBeVisible({ timeout: 60_000 });
  });

  await step(3, async () => {
    await app.tab('Settings');
    const f = app.frame();
    await expect(seen('In the knowledge graph')).toBeVisible({ timeout: 15_000 });
    await seen('Automations').click();
    await f.waitForURL(/\/explorer/);
    await expect(seen('Search')).toBeVisible({ timeout: 15_000 });
    await expect(seen('Optimization')).toBeVisible();
    await app.tab('Settings');
    await seen('Entity types').click();
    await expect(f.getByText('Entity types', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
    await expect(seen(/Twelve domains/, false)).toBeVisible();
    await app.tab('Settings');
    // Each enabled project's own triggers
    await f.getByText(WS, { exact: true }).last().scrollIntoViewIfNeeded();
    await f.getByRole('button', { name: 'Triggers' }).first().click();
    await f.waitForURL(/folder=Harness/);
    await expect(seen('Chat trigger')).toBeVisible({ timeout: 15_000 });
  });
});
