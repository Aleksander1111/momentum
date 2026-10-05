import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'handbook';
const PATTERN = 'Harness/Pattern/automatic-approval-product-devtask';
const task = (i: number) => `---
type: Product/DevTask
origin: user
verification: unverified
product_impact: 3
timeline_impact: 3
unlocks: 3
references: []
artifacts: []
---
# Proofread section ${i}

Proofread section ${i} of the handbook for spelling and broken links.
`;

// The runs never reach Claude Code
scenario('feed-and-patterns', { enabled: [WS] }, async ({ env, api, app, step }) => {
  await step(0, async () => {
    const files = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`knowledge-graph/Product/DevTask/proofread-${i + 1}.md`, task(i + 1)]));
    env.commit(WS, files, 'Plan the proofreading');
    await until('the tasks in the feed', async () => (await api.feed()).items.filter((i) => i.type === 'Product/DevTask').length === 11);
    // Ten approved in the app, the eleventh sent back
    for (let i = 1; i <= 10; i++) await app.approve(WS, `Product/DevTask/proofread-${i}`);
    // Proposed once the tenth approval is through, never taken on unseen: a Harness/Pattern waits in the feed
    const pattern = await until('the pattern proposed', async () =>
      (await env.sql<{ pattern: string; outcome: string; entity_path: string | null; accepted_at: Date | null }[]>`
        select pattern, outcome, entity_path, accepted_at from ${env.sql('ws_handbook.attention_pattern')}`)[0],
    30_000, 500);
    expect(pattern).toEqual({
      pattern: 'Product/DevTask: the last 10 items approved',
      outcome: 'automatic approval',
      entity_path: PATTERN,
      accepted_at: null,
    });
    await until('the pattern in the feed', async () => (await api.feed()).items.some((i) => i.path === PATTERN));
    expect((await api.metrics(WS)).attention.patternsAutomated.value).toBe(0);
    // Approved, it is accepted
    await app.approve(WS, PATTERN);
    await until('the pattern accepted', async () =>
      (await env.sql<{ accepted_at: Date | null }[]>`select accepted_at from ${env.sql('ws_handbook.attention_pattern')}`)[0]?.accepted_at != null,
    30_000, 500);
    const chat = await app.sendBack(WS, 'Product/DevTask/proofread-11', 'Merge this into one task for the whole handbook.');
    expect((await api.run(chat)).targetPath).toBe('Product/DevTask/proofread-11');
    await api.mcp('kill_run', { id: chat });
    expect((await api.runEnded(chat)).status).toBe('killed');
  });

  await step(1, async () => {
    const m = await api.metrics(WS);
    // Ten tasks, and the pattern itself
    expect(m.attention.approved.value).toBe(11);
    expect(m.attention.sentBack.value).toBe(1);
    expect(m.attention.timePerItemSeconds.value).not.toBeNull();
    expect(m.attention.patternsAutomated.value).toBe(1);
    expect(m.understanding.consistency.value).not.toBeNull();
    expect(m.agents.runs.value).toBeGreaterThanOrEqual(1);
    expect(m.agents.automations.find((a) => a.automation === 'chat')?.runs.value).toBeGreaterThanOrEqual(1);
    expect(m.entities.verification.verified.value).toBeGreaterThanOrEqual(10);
    expect(m.implementation.bugs.value).not.toBeNull();
    await app.tab('Metrics');
    await expect(app.text('Rolling 5 hours')).toBeVisible();
  });
});
