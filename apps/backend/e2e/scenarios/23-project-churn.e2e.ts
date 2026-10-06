import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Workspace } from '@momentum/contract';
import { until } from '../support/api.ts';
import { git } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, entitiesOf } from '../support/landed.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'handbook';
const NEW = 'recipes';
const DISH = 'Product/Feature/weekly-menu';

scenario('project-churn', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  const listed = async () => (await api.call<Workspace[]>('GET', '/workspaces')).map((w) => w.name);
  const dir = join(env.root, NEW);

  model.on('the recipes chat', (t) => t.automation === 'chat' && t.kind === 'prompt' && /menu/.test(t.input), (t) => [
    move.write(t, `knowledge-graph/${DISH}.md`, entityText({ type: 'Product/Feature', origin: 'requested', title: 'Weekly menu', card: 'Plan seven dinners from the saved recipes.' })),
    move.say('Added.'),
  ]);
  // Automation runs of the handbook never get an answer until the scenario ends: a hang injected at the network, live too
  model.on('handbook automations wait', (t) => t.automation === 'consistency-check' || t.automation === 'retention', () => [move.hang()]);

  await step(0, async () => {
    mkdirSync(dir);
    writeFileSync(join(dir, 'README.md'), '# Recipes\n\nThe family recipes.\n');
    git(dir, 'init', '-q', '-b', 'master');
    git(dir, 'config', 'user.email', 'e2e@momentum.test');
    git(dir, 'config', 'user.name', 'Momentum e2e');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'Start the recipes');
    await until('the new repository listed', async () => (await listed()).includes(NEW), 60_000);
    expect((await api.settings()).projects.find((p) => p.name === NEW)?.enabled).toBe(false);
  });

  await step(1, async () => {
    await app.setProject(NEW, true);
    await until('the default triggers on master', async () => git(dir, 'ls-tree', '-r', '--name-only', 'master', '--', 'knowledge-graph').includes('Harness/Trigger/chat.md'), 60_000);
    // The graph build is not under test here
    await until('the build to start', async () => (await api.graphBuild(NEW)).state === 'building');
    await api.call('PUT', `/workspaces/${NEW}/graph-build`, { building: false });
    const chat = await app.chat(NEW, 'Write a Product/Feature entity for a weekly menu: plan seven dinners from the saved recipes.');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // Its work landed on master: the feature, which waits in the feed
    const [landed] = await commitsOf(env, NEW, chat);
    expect(git(dir, 'merge-base', '--is-ancestor', landed!, 'master')).toBe('');
    const features = (await entitiesOf(env, NEW, chat)).filter((p) => p.startsWith('Product/Feature/'));
    expect(features.some((p) => /menu/i.test(git(dir, 'show', `master:knowledge-graph/${p}.md`))), `a menu feature among ${features.join(', ')}`).toBe(true);
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('master');
    expect(git(dir, 'branch', '--list').split('\n').map((b) => b.replace('*', '').trim())).toEqual(['master']);
    const feed = (await api.feed()).items.filter((i) => i.workspace === NEW).map((i) => i.path);
    expect(feed).toEqual(expect.arrayContaining(features));
  });

  await step(2, async () => {
    // Two scheduled loops of the handbook: one runs, the other waits its turn
    await env.trigger(WS, 'consistency-check');
    await env.trigger(WS, 'retention');
    await until('one running, one queued', async () => {
      const rows = await api.runs(WS);
      return rows.filter((r) => r.status === 'running').length === 1 && rows.filter((r) => r.status === 'queued').length === 1;
    }, 60_000);
    const running = (await api.runs(WS)).find((r) => r.status === 'running')!;
    await app.setProject(WS, false);
    expect((await api.feed()).items.some((i) => i.workspace === WS)).toBe(false);
    await api.mcp('kill_run', { id: running.id });
    await api.runEnded(running.id);
    await new Promise((r) => setTimeout(r, 10_000));
    expect((await api.runs(WS)).filter((r) => r.status === 'queued')).toHaveLength(1);
    await app.setProject(WS, true);
    await until('the queued run to start', async () => (await api.runs(WS)).some((r) => r.status === 'running'), 60_000);
    expect((await api.feed()).items.some((i) => i.workspace === WS)).toBe(true);
  });

  await step(3, async () => {
    const log = () => readFileSync(env.log, 'utf8').split('\n').filter((l) => l.includes(NEW)).length;
    // Windows keeps a folder a running process works in: nothing of the project runs now
    await until('no run of the project open', async () => !(await api.runs(NEW)).some((r) => r.status === 'queued' || r.status === 'running'));
    // nor does a git command the harness runs in it now and then; one under way at that moment refuses it, so try again
    await until('the folder deleted', async () => {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
        return true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EPERM' && (e as NodeJS.ErrnoException).code !== 'EBUSY') throw e;
        return false;
      }
    }, 60_000, 500);
    await until('the folder gone from the list', async () => !(await listed()).includes(NEW), 60_000);
    expect((await api.feed()).items.some((i) => i.workspace === NEW)).toBe(false);
    // A pass already under way when the folder went may miss it once; none after that
    await new Promise((r) => setTimeout(r, 6000));
    const errors = log();
    await new Promise((r) => setTimeout(r, 10_000));
    // Nothing keeps failing over the project that went
    expect(log()).toBe(errors);
    await app.tab('Feed');
    await app.tab('Settings');
    await expect(app.text(NEW)).toHaveCount(0);
  });
});
