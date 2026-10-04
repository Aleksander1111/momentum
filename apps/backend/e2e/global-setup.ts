import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './support/env.ts';
import { limitOf, readUsage } from './support/usage.ts';
import { OBSERVER, post } from './observer/post.ts';

/**
 * Once per suite: the web app built for the back-ends to serve, the observer started, and the account's limits as the
 * suite starts.
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

  // The test runner's observer, or one already open, is used as it is; otherwise this run starts its own
  const up = () => fetch(OBSERVER, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok).catch(() => false);
  const observer = (await up())
    ? null
    : spawn(process.execPath, [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'e2e/observer/server.ts'], {
        cwd: join(REPO, 'apps', 'backend'),
        env: process.env,
        stdio: 'ignore',
        windowsHide: true,
      });
  const deadline = Date.now() + 30_000;
  while (!(await up())) {
    if (Date.now() > deadline || observer?.exitCode != null) throw new Error(`The observer did not start on ${OBSERVER}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const usage = await readUsage().catch(() => null);
  if (usage) await post({ type: 'usage', ...usage });
  const limit = limitOf(usage);
  await post({
    type: 'note',
    text: usage
      ? `5-hour usage ${usage.fiveHour}%, weekly ${usage.week}% at the start${limit ? `; ${limit}, so real scenarios are skipped` : ''}`
      : 'The account limits could not be read; real scenarios run without the limit check',
  });

  return () => {
    if (observer?.pid) execFileSync('taskkill', ['/pid', String(observer.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  };
}
