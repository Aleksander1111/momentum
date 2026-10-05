import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'todo-cli';
// The runs never reach Claude Code; the graph build run stays running until it is stopped, killed or lost
scenario('lifecycle', { enabled: [WS], graphBuild: 'building' }, async ({ env, api, app, step }) => {
  const buildRun = () => until('a running graph build', async () => (await api.runs(WS, 'graph-build')).find((r) => r.status === 'running'));

  await step(0, async () => {
    const first = await buildRun();
    await app.setProject(WS, false);
    await until('the build stopped', async () => (await api.graphBuild(WS)).state === 'stopped', 30_000);
    expect((await api.runEnded(first.id, 60_000)).status).toBe('killed');
    await app.setProject(WS, true);
    await until('the build to resume', async () => (await api.graphBuild(WS)).state === 'building');
    expect((await buildRun()).id).not.toBe(first.id);
  });

  await step(1, async () => {
    const lost = await buildRun();
    for (let restart = 1; restart <= 3; restart++) {
      env.stop();
      await env.start();
      await app.open();
      if (restart < 3) {
        await until(`run ${lost.id} running again after restart ${restart}`, async () => {
          const [r] = await env.sql<{ status: string; restarts: number }[]>`select status, restarts from ${env.sql(`ws_todo_cli.run`)} where id = ${lost.id}`;
          return r?.status === 'running' && r.restarts === restart;
        });
      }
    }
    const r = await api.run(lost.id);
    expect(r.status).toBe('failed');
    expect(r.error).toBe('lost at restart');
  });

  await step(2, async () => {
    await expect(api.call('POST', '/workspaces/momentum/reset')).rejects.toMatchObject({ status: 409 });
    await app.tab('Settings');
    await app.text('Reset').click();
    await app.text('Confirm reset').click();
    await until('the reset to finish', async () => (await api.graphBuild(WS)).state === 'building' && (await api.graphBuild(WS)).runs <= 1, 120_000);
    const graph = env.files(WS);
    expect(graph.every((f) => f.startsWith('knowledge-graph/Harness/Trigger/'))).toBe(true);
    expect((await api.entities(WS)).every((e) => e.type === 'Harness/Trigger')).toBe(true);
    const runs = await api.runs(WS);
    expect(runs.every((r) => r.automation === 'graph-build')).toBe(true);
    expect(existsSync(join(env.dir, 'runs', WS)) ? runs.length : 0).toBeLessThanOrEqual(1);
  });
});
