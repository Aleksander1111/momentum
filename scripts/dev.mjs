// Development: the back-end restarts on every source change, and the web app is exported again whenever the app or the
// contract change on the main line; the back-end serves the fresh build without a restart. Edits left uncommitted in the
// working tree never reach the served app: it shows what has landed.
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './export-web.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (args) => spawn('pnpm', args, { cwd: root, stdio: 'inherit', shell: true });

const backend = run(['--filter', '@momentum/backend', 'dev']);

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

/** The trees the export is made of at the main line's tip; they change only when a commit touches the app or the contract */
const trees = () => {
  try {
    return execFileSync('git', ['rev-parse', ...SOURCES.map((dir) => `main:${dir}`)], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
};
let built = trees();
setInterval(() => {
  const now = trees();
  if (now === null || now === built) return;
  built = now;
  exportWeb();
}, 2000);
exportWeb();

process.on('SIGINT', () => {
  backend.kill();
  exporting?.kill();
  process.exit(0);
});
