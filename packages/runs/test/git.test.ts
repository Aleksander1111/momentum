import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { changedSince, commitAll, commitPathsFrom, head, land, nonLinear, restorePath, show, workingChanges, workingTree } from '../src/git.ts';

const dir = mkdtempSync(join(tmpdir(), 'momentum-git-'));
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@localhost', ...args], { cwd, encoding: 'utf8' });
const write = (root: string, path: string, text: string) => writeFileSync(join(root, path), text);
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5 }));

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

describe('putting paths back before landing', () => {
  it('lands only what was not put back', async () => {
    const repo = repository('scope', { 'src/auth.ts': 'safe\n', 'src/kept.ts': 'kept\n', 'knowledge-graph/a.md': 'a\n' });
    // The run, in the working directory: code changed, added and deleted, and a change to the knowledge graph
    write(repo, 'src/auth.ts', 'changed\n');
    write(repo, 'src/added.ts', 'added\n');
    rmSync(join(repo, 'src', 'kept.ts'));
    write(repo, 'knowledge-graph/a.md', 'b\n');

    const base = await head(repo);
    for (const c of await workingChanges(repo, base)) {
      if (!c.path.startsWith('knowledge-graph/')) await restorePath(repo, base, c.path);
    }
    const landed = await land(repo, 'main', 'Land the run');

    expect(landed?.changed).toEqual(['knowledge-graph/a.md']);
    expect(await show(repo, 'refs/heads/main', 'knowledge-graph/a.md')).toBe('b\n');
    expect(await show(repo, 'refs/heads/main', 'src/auth.ts')).toBe('safe\n');
    expect(await show(repo, 'refs/heads/main', 'src/kept.ts')).toBe('kept\n');
    expect(await show(repo, 'refs/heads/main', 'src/added.ts')).toBeNull();
  });
});

describe('one straight line in one working directory', () => {
  it('names a branch, a worktree, a detached HEAD and a merge, and nothing on a plain line', async () => {
    const root = repository('line', { 'a.txt': 'a\n' });
    const start = await head(root);
    expect(await nonLinear(root, start)).toEqual([]);

    git(root, 'branch', 'side');
    expect(await nonLinear(root, start)).toEqual(['it has a branch besides main: side']);
    git(root, 'branch', '-D', 'side');

    const linked = join(dir, 'line-linked');
    git(root, 'worktree', 'add', '-q', '--detach', linked);
    const [worktree] = await nonLinear(root, start);
    expect(worktree).toMatch(/^it has a worktree besides its working directory: .*line-linked$/);
    git(root, 'worktree', 'remove', '--force', linked);
    expect(await nonLinear(root, start)).toEqual([]);

    git(root, 'checkout', '-q', '-b', 'side');
    commitIn(root, { 'b.txt': 'b\n' }, 'On the side');
    git(root, 'checkout', '-q', 'main');
    commitIn(root, { 'a.txt': 'a2\n' }, 'On main');
    git(root, 'merge', '-q', '--no-ff', '-m', 'Merge', 'side');
    git(root, 'branch', '-D', 'side');
    const [merge] = await nonLinear(root, start);
    expect(merge).toMatch(/^merge commits landed on main: [0-9a-f]{7}$/);
    // Taken as it stands once the user enables it there
    expect(await nonLinear(root, await head(root))).toEqual([]);

    git(root, 'checkout', '-q', '--detach');
    expect(await nonLinear(root)).toEqual(['its HEAD is detached from any branch']);
  });
});

describe('landing in the working directory', () => {
  it('commits what the run left on top of what the user committed meanwhile', async () => {
    const root = repository('in-place', { 'a.txt': 'a\n', 'b.txt': 'b\n' });
    write(root, 'a.txt', 'run\n');
    // The user commits a file of their own while the run works
    write(root, 'b.txt', 'user\n');
    git(root, 'commit', '-q', '-m', 'The user meanwhile', '--', 'b.txt');
    const tip = await head(root);

    const landed = await land(root, 'main', 'The run');
    expect(landed).toEqual({ commit: await head(root), changed: ['a.txt'] });
    expect(git(root, 'rev-list', '--parents', '-n', '1', 'main').trim().split(' ')).toEqual([landed!.commit, tip]);
    expect(await show(root, 'refs/heads/main', 'a.txt')).toBe('run\n');
    expect(await show(root, 'refs/heads/main', 'b.txt')).toBe('user\n');
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(await land(root, 'main', 'Nothing')).toBeNull();
  });

  it("lands only what the run changed: the user's uncommitted work it found stays as it was, uncommitted", async () => {
    const root = repository('since', { 'a.txt': 'a\n', 'mine.txt': 'mine\n', 'src/auth.ts': 'safe\n' });
    // The user's work in progress, before the run starts: an edit and a new file
    write(root, 'mine.txt', 'mine, half done\n');
    write(root, 'notes.txt', 'scratch\n');
    const since = await workingTree(root);
    // The run: one change it may land, one it may not
    write(root, 'a.txt', 'run\n');
    write(root, 'src/auth.ts', 'changed\n');
    expect((await changedSince(root, since)).map((c) => c.path).sort()).toEqual(['a.txt', 'src/auth.ts']);
    await restorePath(root, since, 'src/auth.ts');

    const landed = await land(root, 'main', 'The run', since);
    expect(landed?.changed).toEqual(['a.txt']);
    expect(await show(root, 'refs/heads/main', 'mine.txt')).toBe('mine\n');
    expect(await show(root, 'refs/heads/main', 'notes.txt')).toBeNull();
    expect(readFileSync(join(root, 'mine.txt'), 'utf8')).toBe('mine, half done\n');
    expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('scratch\n');
    expect(git(root, 'diff', '--name-only', 'HEAD').split('\n').filter(Boolean)).toEqual(['mine.txt']);
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('');
    expect(git(root, 'ls-files', '--others', '--exclude-standard').trim()).toBe('notes.txt');
    // Nothing of its own left: nothing more to land
    expect(await land(root, 'main', 'Again', since)).toBeNull();
  });

  it('refuses a working directory that does not have the main line checked out', async () => {
    const root = repository('off-line', { 'a.txt': 'a\n' });
    git(root, 'checkout', '-q', '--detach');
    write(root, 'a.txt', 'run\n');
    await expect(land(root, 'main', 'The run')).rejects.toThrow(/does not have main checked out/);
  });

  it('keeps the line endings the repository has: a file written back with CRLF changes only where its text does', async () => {
    const root = repository('eol', { 'a.md': 'one\ntwo\nthree\n', 'b.md': 'b\n' });
    // Kept as written, whatever the machine's own setting, as the example projects keep their files
    git(root, 'config', 'core.autocrlf', 'false');
    commitIn(root, { 'w.bat': 'echo\r\n' }, 'A file kept with CRLF');
    // The run rewrites a whole file with CRLF and changes its last line, and only rewrites another
    write(root, 'a.md', 'one\r\ntwo\r\nTHREE\r\n');
    write(root, 'b.md', 'b\r\n');

    expect(await workingChanges(root, await head(root))).toEqual([{ status: 'M', path: 'a.md' }]);
    const landed = await land(root, 'main', 'The run');
    expect(landed?.changed).toEqual(['a.md']);
    expect(await show(root, 'refs/heads/main', 'a.md')).toBe('one\ntwo\nTHREE\n');
    expect(await show(root, 'refs/heads/main', 'w.bat')).toBe('echo\r\n');

    // Only line endings rewritten: nothing to land
    write(root, 'b.md', 'b\r\n');
    expect(await commitAll(root, 'Nothing')).toBeNull();
  });
});

describe('a reaction committed beside the working directory', () => {
  it('updates a clean file, merges into one being changed, and leaves the index on the new commit', async () => {
    const root = repository('reaction', { 'clean.md': 'verification: unverified\n', 'busy.md': 'verification: unverified\none\ntwo\nthree\n' });
    git(root, 'config', 'core.autocrlf', 'false');
    // A run is changing the last line of one of them, written back with CRLF as Windows does
    write(root, 'busy.md', 'verification: unverified\r\none\r\ntwo\r\nTHREE\r\n');

    await commitPathsFrom(
      root,
      'main',
      [
        { path: 'clean.md', content: 'verification: verified\n' },
        { path: 'busy.md', content: 'verification: verified\none\ntwo\nthree\n' },
      ],
      'Approve both',
    );
    expect(readFileSync(join(root, 'clean.md'), 'utf8')).toBe('verification: verified\n');
    expect(readFileSync(join(root, 'busy.md'), 'utf8')).toBe('verification: verified\r\none\r\ntwo\r\nTHREE\r\n');
    expect(git(root, 'status', '--porcelain').trim()).toBe('M busy.md');
    expect(git(root, 'diff', 'HEAD', '--', 'busy.md')).toContain('+THREE');
  });
});
