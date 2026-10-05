import { execFileSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEmbedder } from '@momentum/kb';
import { MODELS, REPO, STALE_MARK } from './support/env.ts';
import { limitOf, readUsage } from './support/usage.ts';
import { post } from './observer/post.ts';

/**
 * Once per suite: the web app built for the back-ends to serve and the account's limits as the suite starts. Tests run
 * only in the test runner, which shows every run, who asked for it and its progress: Playwright started any other way,
 * or without the runner's reporter, refuses.
 */
export default async function globalSetup(config: FullConfig) {
  if (process.env.E2E_FROM_RUNNER !== '1') {
    throw new Error('Tests run only in the test runner: use `pnpm e2e [playwright arguments]` instead of `playwright test`');
  }
  if (!config.reporter.some(([name]) => name.includes('observer'))) {
    throw new Error("The runner shows a run's progress through its reporter: run without --reporter");
  }
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
  // Worlds a suite before could not delete yet; worlds kept for inspection stay
  for (const d of readdirSync(tmpdir()).filter((x) => x.startsWith('momentum-e2e-'))) {
    if (!existsSync(join(tmpdir(), d, STALE_MARK))) continue;
    try {
      rmSync(join(tmpdir(), d), { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // still held: the next suite tries again
    }
  }
  // The embedding model every world's back-end loads, fetched now: a download cut short in a world leaves it unindexed
  await createEmbedder(MODELS)(['warm up']);

  const usage = await readUsage().catch(() => null);
  if (usage) await post({ type: 'usage', ...usage });
  const limit = limitOf(usage);
  await post({
    type: 'note',
    text: usage
      ? `5-hour usage ${usage.fiveHour}%, weekly ${usage.week}% at the start${limit ? `; ${limit}, so real scenarios are skipped` : ''}`
      : 'The account limits could not be read; real scenarios run without the limit check',
  });
}
