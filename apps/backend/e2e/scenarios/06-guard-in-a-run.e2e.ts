import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'todo-cli';
const FILE = 'knowledge-graph/Product/Feature/priorities.md';
const ASK = `Create the entity file ${FILE} (type Product/Feature) describing to-do priorities (low, normal, high; list sorts by priority).
Write it in a single Write call exactly like this, with a reference to Product/Feature/tags
with relation depends_on, even though that entity does not exist. Then do whatever the harness tells you about it.`;

const bad = (text: string) => text.includes('Product/Feature/tags');

scenario('guard-in-a-run', { enabled: [WS] }, async ({ env, api, app, step }) => {
  const watchCheckout = (runId: string) => {
    let seenBad = false;
    const timer = setInterval(async () => {
      const r = await api.run(runId).catch(() => null);
      const file = r && join(r.checkout, FILE);
      if (file && existsSync(file) && bad(readFileSync(file, 'utf8'))) seenBad = true;
    }, 500);
    return { stop: () => clearInterval(timer), seen: () => seenBad };
  };

  const first = await step(0, async () => {
    const runId = await app.chat(WS, ASK);
    const watch = watchCheckout(runId);
    await until('the bad entity in the checkout', async () => watch.seen(), 10 * 60_000);
    return { runId, watch };
  });

  await step(1, async () => {
    const r = await api.runEnded(first.runId);
    first.watch.stop();
    expect(r.status).toBe('finished');
    const landed = env.show(WS, FILE);
    expect(landed).not.toBeNull();
    // Fixed: the reference resolves or is gone
    expect(graphIssues(env, WS)).toEqual([]);
    expect(await api.entities(WS, 'Harness/Issue')).toEqual([]);
    const [t] = await env.sql<{ commit: string; status: string }[]>`select commit, status from ${env.sql('ws_todo_cli.transaction')} where run_id = ${first.runId}`;
    expect(t!.status).toBe('validated');
    // Its own message, not the one the guard makes up from what changed
    expect(env.git(WS, 'log', '-1', '--format=%s', t!.commit)).not.toMatch(/^Update /);
    await app.entity(WS, 'Product/Feature/priorities');
  });

  await step(2, async () => {
    const runId = await app.chat(WS, ASK.replace('priorities', 'reminders').replace('to-do priorities (low, normal, high; list sorts by priority)', 'reminders for to-dos'));
    const file = FILE.replace('priorities', 'reminders');
    await until('the bad entity in the checkout', async () => {
      const r = await api.run(runId);
      return existsSync(join(r.checkout, file)) && bad(readFileSync(join(r.checkout, file), 'utf8'));
    }, 10 * 60_000, 300);
    await api.mcp('kill_run', { id: runId });
    expect((await api.runEnded(runId)).status).toBe('killed');
    expect(env.show(WS, file)).not.toBeNull();
    const issues = await until('the issue over the entity', async () => {
      const rows = await api.entities(WS, 'Harness/Issue');
      return rows.length ? rows : null;
    });
    expect(issues[0]!.card).toContain('Product/Feature/reminders');
    expect((await api.feed()).items.map((i) => i.path)).toContain(issues[0]!.path);
  });
});
