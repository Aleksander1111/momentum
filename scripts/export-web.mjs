// Exports the web app as it stands on the main line, never as the working tree holds it: the sources of the app and the
// contract at `main` are unpacked into .build/web and exported from there into apps/app/dist (or MOMENTUM_APP_DIST), so
// what the back-end serves is what has landed, whatever is left uncommitted in the working tree.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REF = process.env.MOMENTUM_WEB_REF ?? 'main';
/** What the export is made of; the build dir sits inside the repository so modules resolve from its node_modules */
export const SOURCES = ['apps/app', 'packages/contract'];
const build = join(root, '.build', 'web');
const out = process.env.MOMENTUM_APP_DIST ?? join(root, 'apps', 'app', 'dist');

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function exportWeb() {
  const sha = git('rev-parse', '--verify', `${REF}^{commit}`);
  console.log(`[web] exporting ${REF} at ${sha.slice(0, 7)}`);
  for (const dir of SOURCES) rmSync(join(build, dir), { recursive: true, force: true });
  mkdirSync(build, { recursive: true });
  // Relative paths only: GNU tar reads "C:" in an archive path as a remote host
  execFileSync('git', ['-C', root, 'archive', '--format=tar', '-o', join(build, 'sources.tar'), sha, ...SOURCES]);
  execFileSync('tar', ['-xf', 'sources.tar'], { cwd: build });
  rmSync(join(build, 'sources.tar'));
  // The workspace package the app imports, linked as pnpm links it; everything else resolves from the repository's node_modules
  const link = join(build, 'node_modules', '@momentum', 'contract');
  if (!existsSync(link)) {
    mkdirSync(join(build, 'node_modules', '@momentum'), { recursive: true });
    symlinkSync(join(build, 'packages', 'contract'), link, 'junction');
  }
  execFileSync(process.execPath, [join(root, 'node_modules', 'expo', 'bin', 'cli'), 'export', '--platform', 'web', '--output-dir', out], {
    cwd: join(build, 'apps', 'app'),
    stdio: 'inherit',
  });
  return sha;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) exportWeb();
