// The test runner application: a server in the background, on its own, and its page, open in any browser. It is the
// one place tests run: runs are asked for on the page or with `pnpm e2e`, which opens the runner when it is closed. A
// run drives the installed Firefox, headless, on a page of its own; closing the page leaves the runner running. Only
// Quit on the page ends it. Started from the "Momentum tests" shortcut, with `pnpm.cmd e2e:runner`, or by `pnpm e2e`.
// `--background` opens the runner without opening its page.
import { execFile, execFileSync, spawn } from 'node:child_process';
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

/**
 * Starts the runner's server outside every Windows job. A process started from a terminal tab, an editor or a Claude
 * Code session lives in that host's job object, and so does everything it spawns, detached or not: when the host ends
 * the job, the runner and the run under way die with it, without a word in the log. WMI creates the process itself,
 * outside any job, so the runner outlives whatever opened it. Its environment is the user's, not this process's: what
 * it needs comes on its command line.
 */
function startOutsideJobs(cwd: string): void {
  const port = new URL(OBSERVER).port;
  // tsx as a loader, in the one node process: its command line would start a second node, with a console of its own
  const command = `cmd.exe /d /c "set E2E_RUNNER=1&& set E2E_OBSERVER_PORT=${port}&& "${process.execPath}" --import tsx e2e/observer/server.ts"`;
  const ps = [
    '$s = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }',
    `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${command.replaceAll("'", "''")}'; CurrentDirectory = '${cwd.replaceAll("'", "''")}'; ProcessStartupInformation = $s }`,
    'if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create returned $($r.ReturnValue)" }',
  ].join('; ');
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'pipe', windowsHide: true });
}

async function main(): Promise<void> {
  if (!(await up())) {
    startOutsideJobs(join(REPO, 'apps', 'backend'));
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
