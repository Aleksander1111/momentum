import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'bookshelf-api';
const RISK = { low: 'haiku', medium: 'sonnet', high: 'opus' } as const;
const task = (title: string, card: string) => `---
type: Product/DevTask
origin: user
verification: unverified
product_impact: 2
timeline_impact: 1
unlocks: 0
references: []
artifacts: []
---
# ${title}

${card}
`;
const TASKS = {
  'Product/DevTask/fix-readme-typo': task('Fix a typo in the README', 'The README says "libary" once; it should say "library". Nothing else changes.'),
  'Product/DevTask/persistent-store': task(
    'Replace the in-memory store with a database',
    'Move every book into a new SQLite database, change every route to read and write it, migrate the data and change the tests.',
  ),
};

scenario('models-by-risk', { enabled: [WS], triggers: ['implementation'] }, async ({ env, api, app, step, note }) => {
  await step(0, async () => {
    await app.tab('Settings');
    await app.frame().getByRole('radio', { name: 'By risk' }).click();
    await until('risk mode saved', async () => (await api.settings()).models.mode === 'risk');
    expect((await api.settings()).models.risk).toEqual(RISK);
    env.commit(WS, Object.fromEntries(Object.entries(TASKS).map(([p, t]) => [`knowledge-graph/${p}.md`, t])), 'Plan two tasks');
    for (const path of Object.keys(TASKS)) {
      const since = new Date();
      await app.approve(WS, path);
      // The model is chosen when the run starts; the work itself is not needed here
      const run = await until(`the implementation of ${path} on its model`, async () =>
        (await api.runs(WS, 'implementation')).find((r) => r.created_at >= since && r.target_path === path && r.model), 15 * 60_000);
      await api.mcp('kill_run', { id: run.id });
      await api.runEnded(run.id);
      expect(run.risk).toMatch(/^(low|medium|high)$/);
      expect(run.model).toBe(RISK[run.risk as keyof typeof RISK]);
      await note(`${path}: risk ${run.risk}, model ${run.model}`);
    }
    const risks = (await api.runs(WS, 'implementation')).map((r) => r.risk);
    expect(new Set(risks).size, 'the two tasks were judged differently').toBeGreaterThan(1);
  });
});
