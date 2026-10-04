import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { until } from '../support/api.ts';
import { git } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'todo-cli';
const FEATURE = 'knowledge-graph/Product/Feature/due-dates.md';
const feature = (card: string) => `---
type: Product/Feature
origin: user
verification: unverified
product_impact: 2
timeline_impact: 1
unlocks: 1
references: []
artifacts: []
---
# Due dates

${card}
`;

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
    const dir = env.path(WS);
    for (const name of ['first', 'second']) {
      git(dir, 'checkout', '-q', '-b', `momentum/${name}`, 'main');
      writeFileSync(join(dir, `${name}.txt`), `${name}\n`);
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', `Add ${name}`);
      git(dir, 'checkout', '-q', 'main');
    }
    env.stop();
    await env.start();
    await app.open();
    expect(git(dir, 'branch', '--list', 'momentum/*')).toBe('');
    expect(env.show(WS, 'first.txt')).toBe('first');
    expect(env.show(WS, 'second.txt')).toBe('second');
    const log = git(dir, 'log', '--format=%s', 'main');
    expect(log.indexOf('Add second')).toBeLessThan(log.indexOf('Add first'));
  });

  await step(3, async () => {
    const { runId } = await api.chat(WS, 'Add a feature entity for due dates.');
    await until('the chat to start', async () => (await api.run(runId)).status === 'running');
    const checkout = (await api.run(runId)).checkout;
    // The run writes the entity in its checkout, while the user commits another version on the main line
    mkdirSync(dirname(join(checkout, FEATURE)), { recursive: true });
    writeFileSync(join(checkout, FEATURE), feature('Each to-do can carry a due date; `list` shows overdue items first.'));
    env.commit(WS, { [FEATURE]: feature('Each to-do can carry a due date.') }, 'Add due dates');
    await api.mcp('kill_run', { id: runId });
    expect((await api.runEnded(runId)).status).toBe('killed');
    expect(env.show(WS, FEATURE)).toContain('overdue items first');
    const conflicts = await until('the conflict entity', async () => {
      const rows = await api.entities(WS, 'Harness/Conflict');
      return rows.length ? rows : null;
    });
    expect(conflicts[0]!.card).toContain('Product/Feature/due-dates');
    expect((await api.feed()).items.some((i) => i.path === conflicts[0]!.path)).toBe(true);
  });

  await step(4, async () => {
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
