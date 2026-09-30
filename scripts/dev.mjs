// Development: the back-end restarts on every source change, and the web app is exported again whenever its sources
// or the contract change; the back-end serves the fresh build without a restart.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

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
  console.log('[web] exporting');
  exporting = run(['--filter', 'app', 'export:web']);
  exporting.on('exit', (code) => {
    exporting = null;
    console.log(`[web] exported (exit ${code})`);
    if (again) {
      again = false;
      exportWeb();
    }
  });
}

let timer = null;
const trigger = () => {
  clearTimeout(timer);
  timer = setTimeout(exportWeb, 500);
};
for (const dir of ['apps/app/src', 'apps/app/public', 'packages/contract/src']) watch(join(root, dir), { recursive: true }, trigger);
exportWeb();

process.on('SIGINT', () => {
  backend.kill();
  exporting?.kill();
  process.exit(0);
});
