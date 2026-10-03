import { until, type EntityRow } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'handbook';
const SPENT = ['Product/DevTask/migrate-handbook-to-markdown', 'Harness/Research/survey-on-remote-work-preferences'];
const KEPT = ['Governance/Decision/adopt-a-written-handbook', 'Product/Goal/handbook-stays-consistent', 'Product/Product/handbook'];
const retires = (e: EntityRow) =>
  ((e.frontmatter.references as { to: string; relation: string }[] | undefined) ?? []).filter((r) => r.relation === 'retires').map((r) => r.to);

// The retention trigger is approved: its schedule is due at once
scenario('retention', { enabled: [WS], triggers: ['retention'] }, async ({ env, api, app, step }) => {
  const plans = await step(0, async () => {
    const run = await api.automationRan(WS, 'retention', new Date(0));
    expect(run.status).toBe('finished');
    const plans = (await api.entities(WS, 'Harness/Plan')).filter((p) => retires(p).length > 0);
    const retired = plans.flatMap(retires);
    expect(retired).toEqual(expect.arrayContaining(SPENT));
    for (const k of KEPT) expect(retired).not.toContain(k);
    expect(retired.some((p) => p.startsWith('Harness/Trigger/') || p.startsWith('Harness/Automation/'))).toBe(false);
    for (const p of plans) expect(Number(p.frontmatter.product_impact)).toBeLessThanOrEqual(1);
    return plans;
  });

  await step(1, async () => {
    for (const p of plans) await app.approve(WS, p.path);
    await until('the spent entities gone', async () => SPENT.every((p) => env.show(WS, `knowledge-graph/${p}.md`) === null));
    for (const k of KEPT) expect(env.show(WS, `knowledge-graph/${k}.md`)).not.toBeNull();
  });
});
