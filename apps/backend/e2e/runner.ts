// The test runner application: the observer in its own Edge window, where you pick scenarios and run them; a run
// drives that same window. Opening it again while it is open brings the window forward. Closing the window ends the
// runner and any run in it. Started from the "Momentum tests" shortcut, or with `pnpm.cmd e2e:runner`.
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO } from './support/env.ts';
import { OBSERVER } from './observer/post.ts';

const CDP_PORT = Number(process.env.E2E_CDP_PORT ?? 9333);
const cdp = `http://127.0.0.1:${CDP_PORT}`;
export const LOG = join(tmpdir(), 'momentum-tests.log');
const log = (line: string) => appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);

const up = (url: string) => fetch(url, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok).catch(() => false);

/** Already open: bring its window forward instead of opening a second runner */
async function focusOpenRunner(): Promise<boolean> {
  if (!(await up(OBSERVER)) || !(await up(`${cdp}/json/version`))) return false;
  const browser = await chromium.connectOverCDP(cdp, { timeout: 10_000 });
  const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith(OBSERVER));
  if (!page) return false;
  // Attaching resets the window to Playwright's default light scheme
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.bringToFront();
  return true;
}

async function main(): Promise<void> {
  if (await focusOpenRunner()) return log('runner already open: brought it forward');
  if (await up(OBSERVER)) throw new Error(`A test run without the runner is using ${OBSERVER}; let it finish or close it first`);

  // The web app the scenarios load, built once here so each run starts at once
  execFileSync('pnpm', ['--filter', '@momentum/app', 'exec', 'expo', 'export', '--platform', 'web', '--output-dir', join(REPO, '.e2e-web')], {
    cwd: REPO,
    stdio: 'ignore',
    shell: true,
    windowsHide: true,
  });

  const observer = spawn(process.execPath, [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'e2e/observer/server.ts'], {
    cwd: join(REPO, 'apps', 'backend'),
    env: { ...process.env, E2E_RUNNER: '1', E2E_CDP: cdp, E2E_BUILD: '0', MOMENTUM_APP_DIST: join(REPO, '.e2e-web') },
    stdio: 'ignore',
    windowsHide: true,
  });
  const stopObserver = () => {
    if (!observer.pid) return;
    try {
      execFileSync('taskkill', ['/pid', String(observer.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    } catch {
      // already gone
    }
  };
  const deadline = Date.now() + 30_000;
  while (!(await up(OBSERVER))) {
    if (Date.now() > deadline || observer.exitCode !== null) {
      stopObserver();
      throw new Error(`The observer did not start on ${OBSERVER}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const window = await chromium.launchPersistentContext(join(tmpdir(), 'momentum-e2e-runner'), {
    channel: 'msedge',
    headless: false,
    viewport: null,
    colorScheme: 'dark',
    args: ['--start-maximized', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--remote-debugging-port=${CDP_PORT}`],
  });
  const page = window.pages()[0] ?? (await window.newPage());
  await page.goto(OBSERVER);
  log(`runner open on ${OBSERVER}`);

  const stop = () => {
    stopObserver();
    log('runner closed');
    process.exit(0);
  };
  window.on('close', stop);
  process.on('SIGINT', () => void window.close().finally(stop));
}

main().catch((e: Error) => {
  log(`runner failed: ${e.stack ?? e.message}`);
  // Opened without a terminal: show what went wrong
  spawn('notepad', [LOG], { detached: true, stdio: 'ignore' }).unref();
  process.exit(1);
});
