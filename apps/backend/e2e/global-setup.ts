import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './support/env.ts';
import { BUDGET, cap, readUsage } from './support/usage.ts';
import { OBSERVER, post } from './observer/post.ts';

/**
 * Once per suite: the web app built for the back-ends to serve, the observer started, and the 5-hour reading the budget
 * counts from.
 */
export default async function globalSetup() {
  // Its own build of the web app: the development loop exports apps/app/dist again on every change
  const web = join(REPO, '.e2e-web');
  if (process.env.E2E_BUILD !== '0' || !existsSync(join(web, 'index.html'))) {
    execFileSync('pnpm', ['--filter', '@momentum/app', 'exec', 'expo', 'export', '--platform', 'web', '--output-dir', web], {
      cwd: REPO,
      stdio: 'inherit',
      shell: true,
    });
  }
  process.env.MOMENTUM_APP_DIST = web;

  const observer = spawn(process.execPath, [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'e2e/observer/server.ts'], {
    cwd: join(REPO, 'apps', 'backend'),
    env: process.env,
    stdio: 'ignore',
    windowsHide: true,
  });
  const deadline = Date.now() + 30_000;
  while (!(await fetch(OBSERVER).then((r) => r.ok).catch(() => false))) {
    if (Date.now() > deadline || observer.exitCode !== null) throw new Error(`The observer did not start on ${OBSERVER}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const usage = await readUsage();
  // A baseline given keeps the budget of an earlier run that this one continues
  process.env.E2E_FIVE_HOUR_BASELINE ??= String(usage.fiveHour ?? 0);
  await post({ type: 'usage', baseline: usage.fiveHour, fiveHour: usage.fiveHour, week: usage.week, cap: cap() });
  await post({ type: 'note', text: `5-hour usage ${usage.fiveHour}% at the start; real runs stop at ${cap()}% (budget ${BUDGET} points)` });

  return () => {
    if (observer.pid) execFileSync('taskkill', ['/pid', String(observer.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  };
}
