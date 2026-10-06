import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'handbook';
const SPENT = ['Product/DevTask/migrate-handbook-to-markdown', 'Harness/Research/survey-on-remote-work-preferences'];
const KEPT = ['Governance/Decision/adopt-a-written-handbook', 'Product/Goal/handbook-stays-consistent', 'Product/Product/handbook'];

// The retention trigger is approved: its schedule is due at once
scenario('retention', { enabled: [WS], triggers: ['retention'] }, async ({ env, api, step }) => {
  await step(0, async () => {
    const titles = Object.fromEntries(await Promise.all(SPENT.map(async (p) => [p, (await api.entity(WS, p)).title])));
    const run = await api.automationRan(WS, 'retention', new Date(0));
    expect(run.status).toBe('finished');
    // The work is done: the spent entities are gone from the main line, what is relied on stays
    for (const p of SPENT) expect(env.show(WS, `knowledge-graph/${p}.md`)).toBeNull();
    for (const k of KEPT) expect(env.show(WS, `knowledge-graph/${k}.md`)).not.toBeNull();
    expect(env.show(WS, 'knowledge-graph/Harness/Trigger/retention.md')).not.toBeNull();
    // Reported, not proposed: one card names what went, with the titles the entities had
    const report = await until('the removal report in the feed', async () => (await api.feed()).items.find((i) => i.workspace === WS && i.type === 'Harness/Report'));
    const reported = await api.entity(WS, report.path);
    for (const p of SPENT) expect(reported.markdown).toContain(titles[p]!);
    const event = await until('the run on the timeline', async () => (await api.timeline({ workspace: WS })).events.find((e) => e.runId === run.id));
    expect((event.facts.removed ?? []).map((r) => r.path).sort()).toEqual(expect.arrayContaining([...SPENT].sort()));
  });
});
