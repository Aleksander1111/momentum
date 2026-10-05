// The test runner application: a server in the background, on its own, and its page, open in any browser. It is the
// one place tests run: runs are asked for on the page or with `pnpm e2e`, which opens the runner when it is closed. A
// run drives the installed Firefox, headless, on a page of its own; closing the page leaves the runner running. Only
// Quit on the page ends it. Started from the "Momentum tests" shortcut, with `pnpm.cmd e2e:runner`, or by `pnpm e2e`.
// `--background` opens the runner without opening its page.
import { execFile, spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO } from './support/env.ts';
import { OBSERVER } from './observer/post.ts';

export const LOG = join(tmpdir(), 'momentum-tests.log');
const log = (line: string) => appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);

const up = () =>
  fetch(`${OBSERVER}/state`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false);

async function main(): Promise<void> {
  if (!(await up())) {
    // Its own process, outliving this one and any window. tsx as a loader, in that process: its command line would
    // start a second node, which gets a console window of its own when started from a process without one
    spawn(process.execPath, ['--import', 'tsx', 'e2e/observer/server.ts'], {
      cwd: join(REPO, 'apps', 'backend'),
      env: { ...process.env, E2E_RUNNER: '1' },
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    const deadline = Date.now() + 60_000;
    while (!(await up())) {
      if (Date.now() > deadline) throw new Error(`The runner did not start on ${OBSERVER}`);
      await new Promise((r) => setTimeout(r, 300));
    }
    log(`runner open on ${OBSERVER}`);
  }
  // The page, in the default browser
  if (!process.argv.includes('--background')) execFile('cmd', ['/c', 'start', '', OBSERVER], { windowsHide: true });
}

main().catch((e: Error) => {
  log(`runner failed: ${e.stack ?? e.message}`);
  // Opened without a terminal: show what went wrong
  if (!process.argv.includes('--background')) spawn('notepad', [LOG], { detached: true, stdio: 'ignore' }).unref();
  console.error(e.message);
  process.exitCode = 1;
});
