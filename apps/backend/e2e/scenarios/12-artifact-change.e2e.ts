import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'handbook';
const POLICY = 'Governance/Policy/leave-policy';
const DOC = 'docs/leave-policy.md';
const ARCHIVED = 'archive/2019-remote-policy.md';

scenario('artifact-change', { enabled: [WS], settings: { summarization: { exclude: ['archive/**'] } } }, async ({ env, api, app, step }) => {
  const since = await step(0, async () => {
    expect((await api.settings()).summarization.exclude).toEqual(['archive/**']);
    const since = new Date();
    env.commit(
      WS,
      {
        [DOC]: env.show(WS, DOC)!.replace('26 days of paid holiday', '28 days of paid holiday'),
        [ARCHIVED]: `${env.show(WS, ARCHIVED)!}\nNote: superseded in 2021.\n`,
      },
      'Raise the holiday allowance to 28 days',
    );
    return since;
  });

  await step(1, async () => {
    const run = await api.automationRan(WS, 'summarization', since);
    expect(run.status).toBe('finished');
    await until('the policy synced again', async () => (await api.entity(WS, POLICY)).sync === 'synced' && (await api.run(run.id)).status === 'finished');
    const states = await env.sql<{ sync: string }[]>`select sync from ${env.sql('ws_handbook.entity_state')} where path = ${POLICY} and at >= ${since} order by at`;
    const seen = states.map((s) => s.sync);
    expect(seen).toEqual(expect.arrayContaining(['artifact_ahead', 'updating', 'synced']));
    expect(seen.indexOf('artifact_ahead')).toBeLessThan(seen.lastIndexOf('updating'));
    expect((await api.entity(WS, POLICY)).markdown).toMatch(/28 days/);
    expect((await api.runs(WS, 'summarization')).filter((r) => r.created_at >= since)).toHaveLength(1);
    await app.entity(WS, POLICY);
  });

  await step(2, async () => {
    const listed = await env.sql<{ entity_path: string }[]>`select entity_path from ${env.sql('ws_handbook.entity_artifact')} where artifact_path = ${ARCHIVED}`;
    expect(listed).toEqual([]);
  });
});
