import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { MODEL } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'todo-cli';
// Every default trigger but optimization's, which runs in the harness workspace alone
const TRIGGERS = 8;
// The default triggers wait in the feed once the project is enabled, so the first build runs have room for two entities
const FEED = TRIGGERS + 2;

scenario('onboard', { settings: { feedSize: FEED } }, async ({ env, api, app, step, note }) => {
  await step(0, async () => {
    await app.tab('Settings');
    expect((await api.settings()).projects.find((p) => p.name === WS)?.enabled).toBe(false);
    await app.setProject(WS, true);
    const agents = join(env.path(WS), '.claude', 'agents');
    await until('the definitions materialized', async () => existsSync(join(agents, 'momentum-graph-build.md')));
    expect(readFileSync(join(env.path(WS), '.git', 'info', 'exclude'), 'utf8')).toContain('.claude/agents/momentum-*');
    const triggers = await until('the default triggers', async () => {
      const rows = await api.entities(WS, 'Harness/Trigger');
      return rows.length === TRIGGERS ? rows : null;
    });
    expect(triggers.every((t) => t.verification === 'unverified')).toBe(true);
    // The user's checkout follows the main line, file by file, and is clean once it has
    await until('the checkout to follow the main line', async () => env.git(WS, 'status', '--porcelain') === '', 60_000);
  });

  await step(1, async () => {
    await new Promise((r) => setTimeout(r, 10_000));
    expect((await api.runs(WS)).filter((r) => r.automation !== 'graph-build')).toEqual([]);
  });

  await step(2, async () => {
    const first = await api.automationRan(WS, 'graph-build', new Date(0));
    expect(first.status).toBe('finished');
    expect(first.model).toBe(MODEL);
    if ((await api.graphBuild(WS)).state === 'complete') {
      await note('The build covered the repository in its first run: no pause to observe');
      return;
    }
    // The feed is full: the next build run waits
    await until('the feed to fill', async () => (await api.feed()).items.length >= FEED, 120_000);
    await new Promise((r) => setTimeout(r, 12_000));
    expect((await api.runs(WS, 'graph-build')).filter((r) => r.status === 'queued' || r.status === 'running')).toEqual([]);
    // Approving what the build wrote makes room, and the build goes on
    const written = (await api.feed()).items.filter((i) => i.type !== 'Harness/Trigger');
    for (const item of written) await app.approve(WS, item.path);
    await until('the next build run', async () => (await api.runs(WS, 'graph-build')).length > 1, 120_000);
    // The rest of the build gets the room it needs
    await api.putSettings({ feedSize: 40 });
  });

  await step(3, async () => {
    await until('the build to complete', async () => (await api.graphBuild(WS)).state === 'complete', 90 * 60_000, 10_000);
    const status = await api.graphBuild(WS);
    expect(status.completeness.score).toBeGreaterThan(0);
    expect(status.progress).toBeTruthy();
    expect(status.entities).toBeGreaterThan(0);
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await api.entities(WS, 'Harness/Issue')).toEqual([]);
    // The documents the build listed were summarized: their entities list them as artifacts
    const artifacts = await env.sql<{ artifact_path: string }[]>`select artifact_path from ${env.sql('ws_todo_cli.entity_artifact')}`;
    expect(artifacts.map((a) => a.artifact_path)).toEqual(expect.arrayContaining(['README.md']));
    await app.tab('Explorer');
  });

  await step(4, async () => {
    const runs = await api.runs(WS, 'graph-build');
    expect(runs.every((r) => r.status === 'finished')).toBe(true);
    const usage = await env.sql<{ usage_five_hour: number | null }[]>`select usage_five_hour from ${env.sql('ws_todo_cli.run')}`;
    expect(usage.every((u) => u.usage_five_hour !== null)).toBe(true);
    const metrics = await env.sql<{ run_id: string }[]>`select run_id from ${env.sql('ws_todo_cli.agent_metric')}`;
    expect(new Set(metrics.map((m) => m.run_id))).toEqual(new Set(runs.map((r) => r.id)));
    const checkouts = join(env.dir, 'runs', WS);
    expect(existsSync(checkouts) ? readdirSync(checkouts) : []).toEqual([]);
    expect(env.git(WS, 'worktree', 'list').split('\n')).toHaveLength(1);
    expect(readFileSync(env.log, 'utf8')).not.toContain('procgov could not limit');
  });
});
