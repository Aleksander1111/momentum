// `pnpm e2e [playwright arguments]`: asks the test runner to run tests, instead of running them here. The runner is the
// one place tests run: it shows every run, who asked for it and its progress. Not open: it is opened first. A run
// already going: this one waits its turn. What the run prints comes back here, and this exits with the run's exit code;
// stopping this stops the run. With --detach it is queued and this returns at once: the run goes on whatever becomes of
// this process, its output in .e2e-runs/<request>.log and its result in the runner's state.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { REPO } from './support/env.ts';
import { OBSERVER } from './observer/post.ts';

interface RunnerState {
  runner: { available: boolean };
}

const state = () =>
  fetch(`${OBSERVER}/state`, { signal: AbortSignal.timeout(2000) })
    .then((r) => (r.ok ? (r.json() as Promise<RunnerState>) : null))
    .catch(() => null);

/** The runner, opened in the background when it is not */
async function runner(): Promise<void> {
  let s = await state();
  if (s && !s.runner.available) throw new Error(`Something other than the test runner is using ${OBSERVER}; close it first`);
  if (s) return;
  console.log(`Opening the test runner on ${OBSERVER}…`);
  // None of this request's settings but the ports it is reached on
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('E2E_') || k === 'E2E_OBSERVER_PORT'),
  );
  spawn(process.execPath, ['--import', 'tsx', 'e2e/runner.ts', '--background'], {
    cwd: join(REPO, 'apps', 'backend'),
    env,
    stdio: 'ignore',
    windowsHide: true,
  });
  const deadline = Date.now() + 2 * 60_000;
  while (!(s = await state())?.runner.available) {
    if (Date.now() > deadline) throw new Error('The test runner did not open; see momentum-tests.log in the temp folder');
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Who asked: the Claude Code chat running this, or the terminal */
function requester(): { label: string; session: string | null } {
  const session = process.env.CLAUDE_CODE_HOST_SESSION_ID ?? process.env.CLAUDE_CODE_SESSION_ID ?? null;
  const label = process.env.E2E_BY ?? (session ? 'Claude Code chat' : 'Terminal');
  return { label, session };
}

async function main(): Promise<number> {
  const given = process.argv.slice(2).filter((a) => a !== '--');
  const args: string[] = [];
  // --detach: queued and left to the runner, which runs it whatever becomes of this process
  let detach = false;
  for (let i = 0; i < given.length; i++) {
    const a = given[i]!;
    // The runner's reporter is what shows the progress: it stays
    if (a === '--detach') detach = true;
    else if (a === '--reporter') console.log(`Ignored --reporter ${given[++i]}: the runner always reports to its window and here`);
    else if (a.startsWith('--reporter=')) console.log(`Ignored ${a}: the runner always reports to its window and here`);
    else args.push(a);
  }
  // The request's settings for the run: anything E2E_ but how the runner itself is wired
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k.startsWith('E2E_') && !['E2E_RUNNER', 'E2E_OBSERVER_PORT', 'E2E_BY'].includes(k)),
  ) as Record<string, string>;
  // As before the runner: the web app built again unless E2E_BUILD=0 says the last build will do
  env.E2E_BUILD ??= '1';

  await runner();
  const res = await fetch(`${OBSERVER}/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ args, env, by: requester(), detach }),
  });
  if (detach) {
    if (!res.ok) throw new Error(`The runner refused the request: ${res.status} ${await res.text()}`);
    const { id, log } = (await res.json()) as { id: string; log: string };
    console.log(`Queued as request ${id} in the test runner (${OBSERVER}); its output: ${log}`);
    return 0;
  }
  if (!res.ok || !res.body) throw new Error(`The runner refused the request: ${res.status} ${await res.text()}`);
  console.log(`Running in the test runner (${OBSERVER}); stopping this stops the run.`);

  // The run's output line by line; the last line is its exit code
  let code = 1;
  let rest = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    rest += decoder.decode(chunk as Uint8Array, { stream: true });
    const lines = rest.split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) {
      const m = /^\u0000exit (-?\d+)$/.exec(line);
      if (m) code = Number(m[1]);
      // Lines starting with NUL are the runner's own: keep-alives
      else if (!line.startsWith('\u0000')) console.log(line);
    }
  }
  return code;
}

// Exit codes set, not exited with: exiting while the response stream closes trips a libuv assertion on Windows
main().then(
  (code) => (process.exitCode = code),
  (e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  },
);
