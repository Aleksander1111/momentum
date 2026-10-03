import { until, type EntityRow } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'handbook';
const REMOTE = 'Governance/Policy/remote-work';
const ONBOARDING = 'Knowledge/HowToGuide/onboarding';
const MEETINGS = ['Knowledge/HowToGuide/weekly-meeting', 'Governance/Policy/weekly-meetings'];
const concerns = (e: EntityRow) => ((e.frontmatter.references as { to: string; relation: string }[] | undefined) ?? []).map((r) => r.to);

// The consistency check trigger is approved: its schedule is due at once
scenario('consistency', { enabled: [WS], triggers: ['consistency-check'] }, async ({ env, api, app, step }) => {
  const start = env.git(WS, 'rev-list', '--max-parents=0', 'main');

  const { contradiction, naming } = await step(0, async () => {
    const run = await api.automationRan(WS, 'consistency-check', new Date(0));
    expect(run.status).toBe('finished');
    const issues = await api.entities(WS, 'Harness/Issue');
    const contradiction = issues.find((i) => i.frontmatter.category === 'contradiction' && [REMOTE, ONBOARDING].every((p) => concerns(i).includes(p)));
    const naming = issues.find((i) => MEETINGS.every((p) => concerns(i).includes(p)));
    expect(contradiction, 'the remote work contradiction').toBeDefined();
    expect(naming, 'the weekly meeting clash').toBeDefined();
    for (const i of [contradiction!, naming!]) {
      expect(['high', 'medium', 'low']).toContain(i.frontmatter.severity);
      expect((i.frontmatter.options as unknown[]).length).toBeGreaterThanOrEqual(2);
    }
    // It fixes nothing: only issues were added
    const changed = env.git(WS, 'diff', '--name-only', start, 'main', '--', 'knowledge-graph').split('\n').filter(Boolean);
    expect(changed.filter((f) => !f.startsWith('knowledge-graph/Harness/Issue/') && !f.startsWith('knowledge-graph/Harness/Trigger/'))).toEqual([]);
    return { contradiction: contradiction!, naming: naming! };
  });

  await step(1, async () => {
    const counts = await Promise.all([REMOTE, ONBOARDING].map(async (p) => (await api.entity(WS, p)).contradictions));
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(1);
  });

  await step(2, async () => {
    const item = (await api.feed()).items.find((i) => i.path === contradiction.path)!;
    expect(item.issue!.options.length).toBeGreaterThanOrEqual(2);
    const option = item.issue!.recommended ?? 0;
    const chat = await app.resolve(WS, contradiction.path, option);
    expect((await api.runEnded(chat)).status).toBe('finished');
    const fixed = await until('a fixed policy waiting in the feed', async () =>
      (await api.feed()).items.find((i) => [REMOTE, ONBOARDING].includes(i.path) && i.diff !== null), 10 * 60_000);
    expect(fixed.verification).toBe('unverified');
    await app.go('/feed');
  });

  await step(3, async () => {
    await app.wontResolve(WS, naming.path, 'They are different meetings; both names stay.');
    const e = await api.entity(WS, naming.path);
    expect(e.verification).toBe('verified');
    expect(env.show(WS, `knowledge-graph/${naming.path}.md`)).toContain('wont_resolve: They are different meetings');
  });
});
