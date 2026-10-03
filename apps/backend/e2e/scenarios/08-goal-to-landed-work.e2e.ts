import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { until, type EntityRow } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'bookshelf-api';
const ACTIONS = ['Product/Feature', 'Product/FeatureRequest', 'Product/UserStory', 'Product/DevTask', 'Product/Bug', 'Product/TechDebt'];
const refs = (e: EntityRow) => (e.frontmatter.references as { to: string; relation: string }[] | undefined) ?? [];

// Only the exploration trigger is approved: its schedule is due at once, so exploration starts at the first tick
scenario('goal-to-landed-work', { enabled: [WS], triggers: ['exploration'] }, async ({ env, api, app, step }) => {
  const action = await step(0, async () => {
    const run = await api.automationRan(WS, 'exploration', new Date(0));
    expect(run.trigger).toBe('schedule');
    expect(run.status).toBe('finished');
    const research = await api.entities(WS, 'Harness/Research');
    expect(research.length).toBeGreaterThan(0);
    const all = await api.entities(WS);
    const action = all.find((e) => ACTIONS.includes(e.type) && refs(e).some((r) => r.relation === 'advances' && r.to.startsWith('Product/Goal/')));
    expect(action, 'an action entity advancing a goal').toBeDefined();
    expect(refs(action!).some((r) => r.relation === 'based_on' && research.some((x) => x.path === r.to))).toBe(true);
    return action!;
  });

  const plan = await step(1, async () => {
    await app.approve(WS, action.path);
    expect((await api.entity(WS, action.path)).sync).toBe('entity_ahead');
    const since = new Date();
    await app.approve(WS, 'Harness/Trigger/preparation');
    const run = await api.automationRan(WS, 'preparation', since);
    expect(run.status).toBe('finished');
    return until('a plan for the action', async () => (await api.entities(WS, 'Harness/Plan')).find((p) => refs(p).some((r) => r.to === action.path)), 15 * 60_000);
  });

  const implementation = await step(2, async () => {
    await app.approve(WS, 'Harness/Trigger/implementation');
    // Validation runs on landed work here, not on its nightly schedule
    const file = 'knowledge-graph/Harness/Trigger/validation.md';
    env.commit(WS, { [file]: env.show(WS, file)!.replace(/^schedule: .*\r?\n/m, '') }, 'Validate landed work only');
    await app.approve(WS, 'Harness/Trigger/validation');
    const before = env.head(WS);
    const since = new Date();
    await app.approve(WS, plan.path);
    const run = await api.automationRan(WS, 'implementation', since, 60 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.target_path).toBe(plan.path);
    const [t] = await env.sql<{ commit: string }[]>`select commit from ${env.sql('ws_bookshelf_api.transaction')} where run_id = ${run.id}`;
    expect(t!.commit).toBeTruthy();
    expect(env.git(WS, 'diff', '--name-only', before, t!.commit, '--', 'src')).not.toBe('');
    return { run, since };
  });

  await step(3, async () => {
    const run = await api.automationRan(WS, 'validation', new Date(implementation.run.ended_at!), 60 * 60_000);
    expect(run.trigger).toBe('event');
    expect(run.status).toBe('finished');
    const dir = mkdtempSync(join(tmpdir(), 'bookshelf-main-'));
    try {
      env.git(WS, 'worktree', 'add', '--detach', dir, 'main');
      let passes = true;
      try {
        execFileSync(process.execPath, ['--test'], { cwd: dir, stdio: 'ignore', windowsHide: true });
      } catch {
        passes = false;
      }
      if (!passes) {
        const raised = [...(await api.entities(WS, 'Harness/Issue')), ...(await api.entities(WS, 'Product/Bug'))];
        expect(raised.some((e) => /title/i.test(e.card)), 'the failing empty-title test raised as an issue').toBe(true);
      }
    } finally {
      env.git(WS, 'worktree', 'remove', '--force', dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  await step(4, async () => {
    const runs = (await api.runs(WS)).filter((r) => r.trigger !== 'on_demand' && r.started_at).sort((a, b) => +a.started_at! - +b.started_at!);
    for (let i = 1; i < runs.length; i++) {
      expect(+runs[i]!.started_at!, `${runs[i]!.automation} started after ${runs[i - 1]!.automation} ended`).toBeGreaterThanOrEqual(+runs[i - 1]!.ended_at!);
    }
  });
});
