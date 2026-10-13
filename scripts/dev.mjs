// Development: the back-end and the web app serve what has landed on the main line. The back-end restarts whenever a
// commit changes its sources, a few seconds after, once the run that landed it has finished recording; the web app is
// exported again whenever a commit changes the app or the contract, and the back-end serves the fresh build without a
// restart. Runs work in this repository's one working directory: their edits in progress never restart the back-end or
// reach the served app.
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './export-web.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
/** What the back-end runs from: a commit that changes any of these restarts it */
const BACKEND = ['apps/backend/src', 'apps/backend/package.json', 'packages'];
/** How long a commit of the back-end's sources settles before the restart: the run that landed it records its end */
const SETTLE_MS = 10_000;

/** The trees of these paths at the main line's tip; they change only when a commit touches them */
const trees = (paths) => {
  try {
    return execFileSync('git', ['rev-parse', ...paths.map((dir) => `main:${dir}`)], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
};

let backend = null;
let stopping = false;
function startBackend() {
  backend = spawn('pnpm', ['--filter', '@momentum/backend', 'start'], { cwd: root, stdio: 'inherit', shell: true });
  backend.on('exit', (code) => {
    backend = null;
    if (stopping) return;
    console.log(`[backend] exited (${code}); starting again`);
    setTimeout(startBackend, 2000);
  });
}

/** Ends the back-end with every process it started: the runs' Claude Code processes go with it */
function stopBackend() {
  if (!backend) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(backend.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    } catch {
      // gone meanwhile
    }
  } else backend.kill();
}

let exporting = null;
let again = false;
function exportWeb() {
  if (exporting) {
    again = true;
    return;
  }
  exporting = spawn(process.execPath, ['scripts/export-web.mjs'], { cwd: root, stdio: 'inherit' });
  exporting.on('exit', (code) => {
    exporting = null;
    console.log(`[web] exported (exit ${code})`);
    if (again) {
      again = false;
      exportWeb();
    }
  });
}

let served = trees(BACKEND);
let restart = null;
let built = trees(SOURCES);
setInterval(() => {
  const backendNow = trees(BACKEND);
  if (backendNow !== null && backendNow !== served) {
    served = backendNow;
    clearTimeout(restart);
    restart = setTimeout(() => {
      console.log('[backend] its sources changed on main; restarting');
      // The exit handler starts it again
      stopBackend();
    }, SETTLE_MS);
  }
  const webNow = trees(SOURCES);
  if (webNow !== null && webNow !== built) {
    built = webNow;
    exportWeb();
  }
}, 2000);

startBackend();
exportWeb();

process.on('SIGINT', () => {
  stopping = true;
  stopBackend();
  exporting?.kill();
  process.exit(0);
});
