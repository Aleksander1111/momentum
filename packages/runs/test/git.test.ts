import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { commitAll, ensureCheckout, head, land, landCommit, mergeBase, nonLinear, restorePath, show, workingChanges } from '../src/git.ts';

const dir = mkdtempSync(join(tmpdir(), 'momentum-git-'));
const repo = join(dir, 'repo');
const checkout = join(dir, 'checkout');
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@localhost', ...args], { cwd, encoding: 'utf8' });
const write = (root: string, path: string, text: string) => writeFileSync(join(root, path), text);
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5 }));

describe('putting paths back before landing', () => {
  it('lands only what was not put back, whether the run committed it or left it', async () => {
    mkdirSync(join(repo, 'src'), { recursive: true });
    mkdirSync(join(repo, 'knowledge-graph'));
    git(repo, 'init', '-q', '-b', 'main');
    write(repo, 'src/auth.ts', 'safe\n');
    write(repo, 'src/kept.ts', 'kept\n');
    write(repo, 'knowledge-graph/a.md', 'a\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'Start');
    await ensureCheckout(repo, checkout, 'main');

    // The run: a change to code it committed, code it added and deleted, and a change to the knowledge graph
    write(checkout, 'src/auth.ts', 'changed\n');
    git(checkout, 'commit', '-q', '-am', 'A commit of the run');
    write(checkout, 'src/added.ts', 'added\n');
    rmSync(join(checkout, 'src', 'kept.ts'));
    write(checkout, 'knowledge-graph/a.md', 'b\n');

    const base = await mergeBase(repo, 'refs/heads/main', await head(checkout));
    for (const c of await workingChanges(checkout, base)) {
      if (!c.path.startsWith('knowledge-graph/')) await restorePath(checkout, base, c.path);
    }
    const landed = await land(repo, 'main', checkout, 'Land the run');

    expect(landed?.changed).toEqual(['knowledge-graph/a.md']);
    expect(await show(repo, 'refs/heads/main', 'knowledge-graph/a.md')).toBe('b\n');
    expect(await show(repo, 'refs/heads/main', 'src/auth.ts')).toBe('safe\n');
    expect(await show(repo, 'refs/heads/main', 'src/kept.ts')).toBe('kept\n');
    expect(await show(repo, 'refs/heads/main', 'src/added.ts')).toBeNull();
  });
});

/** A repository on main with one commit of these files */
function repository(name: string, files: Record<string, string>): string {
  const root = join(dir, name);
  mkdirSync(root, { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    write(root, path, text);
  }
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'Start');
  return root;
}
const commitIn = (root: string, files: Record<string, string>, message: string) => {
  for (const [path, text] of Object.entries(files)) write(root, path, text);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', message);
};

describe('one straight line', () => {
  it('names a branch, a detached HEAD and a merge, and nothing on a plain line', async () => {
    const root = repository('line', { 'a.txt': 'a\n' });
    const start = await head(root);
    expect(await nonLinear(root, start)).toEqual([]);

    git(root, 'branch', 'side');
    expect(await nonLinear(root, start)).toEqual(['it has a branch besides main: side']);

    git(root, 'checkout', '-q', 'side');
    commitIn(root, { 'b.txt': 'b\n' }, 'On the side');
    git(root, 'checkout', '-q', 'main');
    commitIn(root, { 'a.txt': 'a2\n' }, 'On main');
    git(root, '-c', 'user.name=test', '-c', 'user.email=test@localhost', 'merge', '-q', '--no-ff', '-m', 'Merge', 'side');
    git(root, 'branch', '-D', 'side');
    const [merge] = await nonLinear(root, start);
    expect(merge).toMatch(/^merge commits landed on main: [0-9a-f]{7}$/);
    // Taken as it stands once the user enables it there
    expect(await nonLinear(root, await head(root))).toEqual([]);

    git(root, 'checkout', '-q', '--detach');
    expect(await nonLinear(root)).toEqual(['its HEAD is detached from any branch']);
  });
});

describe('landing on a main line that moved', () => {
  it('replays the run as one commit on the new tip', async () => {
    const root = repository('replay', { 'a.txt': 'a\n', 'b.txt': 'b\n' });
    const run = join(dir, 'replay-run');
    await ensureCheckout(root, run, 'main');
    write(run, 'a.txt', 'run\n');
    commitIn(root, { 'b.txt': 'user\n' }, 'The user meanwhile');
    const tip = await head(root);

    const landed = await landCommit(root, 'main', (await commitAll(run, 'The run'))!, 'The run');
    expect(landed).toMatchObject({ conflicts: [], changed: ['a.txt'] });
    expect(git(root, 'rev-list', '--parents', '-n', '1', 'main').trim().split(' ')).toEqual([landed!.commit, tip]);
    expect(await show(root, 'refs/heads/main', 'a.txt')).toBe('run\n');
    expect(await show(root, 'refs/heads/main', 'b.txt')).toBe('user\n');
  });

  it("takes the run's side of a conflicting file, with what the harness raises in the same commit", async () => {
    const root = repository('conflict', { 'a.txt': 'a\n' });
    const run = join(dir, 'conflict-run');
    await ensureCheckout(root, run, 'main');
    write(run, 'a.txt', 'run\n');
    commitIn(root, { 'a.txt': 'user\n' }, 'The user meanwhile');

    const raised: string[][] = [];
    const landed = await landCommit(root, 'main', (await commitAll(run, 'The run'))!, 'The run', async (conflicts) => {
      raised.push(conflicts);
      return [{ path: 'knowledge-graph/Harness/Conflict/run.md', content: 'conflict\n' }];
    });
    expect(raised).toEqual([['a.txt']]);
    expect(landed?.conflicts).toEqual(['a.txt']);
    expect(await show(root, 'refs/heads/main', 'a.txt')).toBe('run\n');
    expect(await show(root, 'refs/heads/main', 'knowledge-graph/Harness/Conflict/run.md')).toBe('conflict\n');
  });

  it('keeps the line endings the repository has: a file written back with CRLF changes only where its text does', async () => {
    const root = repository('eol', { 'a.md': 'one\ntwo\nthree\nfour\nfive\nsix\n', 'b.md': 'b\n' });
    // Kept as written, whatever the machine's own setting, as the example projects keep their files
    git(root, 'config', 'core.autocrlf', 'false');
    commitIn(root, { 'w.bat': 'echo\r\n' }, 'A file kept with CRLF');
    const run = join(dir, 'eol-run');
    await ensureCheckout(root, run, 'main');
    // The run rewrites a whole file with CRLF and changes its last line, and only rewrites another
    write(run, 'a.md', 'one\r\ntwo\r\nthree\r\nfour\r\nfive\r\nSIX\r\n');
    write(run, 'b.md', 'b\r\n');
    commitIn(root, { 'a.md': 'ONE\ntwo\nthree\nfour\nfive\nsix\n' }, 'The user meanwhile');

    expect(await workingChanges(run, await head(run))).toEqual([{ status: 'M', path: 'a.md' }]);
    const landed = await landCommit(root, 'main', (await commitAll(run, 'The run'))!, 'The run');
    expect(landed).toMatchObject({ conflicts: [], changed: ['a.md'] });
    expect(await show(root, 'refs/heads/main', 'a.md')).toBe('ONE\ntwo\nthree\nfour\nfive\nSIX\n');
    expect(await show(root, 'refs/heads/main', 'w.bat')).toBe('echo\r\n');

    // Only line endings rewritten: nothing to land
    const only = join(dir, 'eol-only');
    await ensureCheckout(root, only, 'main');
    write(only, 'b.md', 'b\r\n');
    expect(await commitAll(only, 'Nothing')).toBeNull();
  });
});
