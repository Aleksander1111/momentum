import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
  }
}

export async function git(cwd: string, args: string[], input?: string): Promise<string> {
  try {
    const child = exec('git', args, { cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' });
    if (input !== undefined) {
      child.child.stdin?.end(input);
    }
    const { stdout } = await child;
    return stdout;
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new GitError(`git ${args.join(' ')}: ${err.stderr?.trim() || err.message}`, err.stderr ?? '');
  }
}

export async function isRepository(dir: string): Promise<boolean> {
  return existsSync(`${dir}/.git`);
}

export async function head(cwd: string, ref = 'HEAD'): Promise<string> {
  return (await git(cwd, ['rev-parse', ref])).trim();
}

export async function currentBranch(cwd: string): Promise<string> {
  return (await git(cwd, ['symbolic-ref', '--short', 'HEAD'])).trim();
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

/** Own checkout on its own branch: git worktree under C:\Projects\.runs\<workspace>\<run-id> */
export async function addWorktree(repo: string, checkout: string, branch: string, base: string): Promise<void> {
  if (existsSync(checkout)) return;
  await mkdir(dirname(checkout), { recursive: true });
  if (await branchExists(repo, branch)) await git(repo, ['worktree', 'add', checkout, branch]);
  else await git(repo, ['worktree', 'add', '-b', branch, checkout, base]);
}

export async function removeWorktree(repo: string, checkout: string): Promise<void> {
  if (existsSync(checkout)) await git(repo, ['worktree', 'remove', '--force', checkout]);
  await git(repo, ['worktree', 'prune']);
}

export async function deleteBranch(repo: string, branch: string): Promise<void> {
  if (await branchExists(repo, branch)) await git(repo, ['branch', '-D', branch]);
}

/** Commits everything in the checkout; returns the new commit, or null when nothing changed */
export async function commitAll(checkout: string, message: string): Promise<string | null> {
  await git(checkout, ['add', '-A']);
  const status = await git(checkout, ['status', '--porcelain']);
  if (!status.trim()) return null;
  await git(checkout, ['-c', 'user.name=Momentum', '-c', 'user.email=momentum@localhost', 'commit', '-q', '-m', message]);
  return head(checkout);
}

export interface Change {
  status: 'A' | 'M' | 'D';
  path: string;
}

export async function changes(cwd: string, from: string, to: string, pathspec?: string): Promise<Change[]> {
  const args = ['diff', '--name-status', '--no-renames', from, to];
  if (pathspec) args.push('--', pathspec);
  const out = await git(cwd, args);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status: (status?.[0] ?? 'M') as Change['status'], path: path ?? '' };
    });
}

export async function show(cwd: string, ref: string, path: string): Promise<string | null> {
  try {
    return await git(cwd, ['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

export async function listFiles(cwd: string, ref: string, dir: string): Promise<string[]> {
  const out = await git(cwd, ['ls-tree', '-r', '--name-only', ref, '--', dir]);
  return out.split('\n').filter(Boolean);
}

export async function mergeBase(cwd: string, a: string, b: string): Promise<string> {
  return (await git(cwd, ['merge-base', a, b])).trim();
}

const IDENTITY = ['-c', 'user.name=Momentum', '-c', 'user.email=momentum@localhost'];

/**
 * Commits the given file contents onto `targetBranch` without touching any working tree;
 * then brings the files up to date in the checkout that has the branch checked out, where they were clean.
 */
export async function commitPathsFrom(
  repo: string,
  targetBranch: string,
  files: { path: string; content: string | null }[],
  message: string,
): Promise<string> {
  const parent = await head(repo, `refs/heads/${targetBranch}`);
  const tmpIndex = `${repo}/.git/momentum-index-${process.pid}-${Date.now()}`;
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  const run = async (args: string[], input?: string) => {
    const child = exec('git', args, { cwd: repo, env, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' });
    if (input !== undefined) child.child.stdin?.end(input);
    return (await child).stdout.trim();
  };
  try {
    await run(['read-tree', parent]);
    for (const f of files) {
      if (f.content === null) {
        await run(['update-index', '--force-remove', '--', f.path]);
      } else {
        const blob = await run(['hash-object', '-w', '--stdin'], f.content);
        await run(['update-index', '--add', '--cacheinfo', `100644,${blob},${f.path}`]);
      }
    }
    const tree = await run(['write-tree']);
    const commit = await run([...IDENTITY, 'commit-tree', tree, '-p', parent, '-m', message]);
    await git(repo, ['update-ref', `refs/heads/${targetBranch}`, commit, parent]);
    await syncCheckedOut(repo, targetBranch, parent, files.map((f) => f.path));
    return commit;
  } finally {
    await rm(tmpIndex, { force: true });
  }
}

/** Updates the files in the working tree that has `branch` checked out, where they matched the previous commit */
async function syncCheckedOut(repo: string, branch: string, previous: string, paths: string[]): Promise<void> {
  const list = await git(repo, ['worktree', 'list', '--porcelain']);
  const tree = list
    .split('\n\n')
    .map((block) => ({
      dir: /^worktree (.+)$/m.exec(block)?.[1],
      branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1],
    }))
    .find((w) => w.branch === branch)?.dir;
  if (!tree) return;
  for (const path of paths) {
    const dirty = (await git(tree, ['diff', '--name-only', previous, '--', path])).trim();
    const untracked = (await git(tree, ['ls-files', '--others', '--exclude-standard', '--', path])).trim();
    if (dirty || untracked) continue;
    const exists = (await git(tree, ['ls-tree', '--name-only', 'HEAD', '--', path])).trim();
    if (exists) await git(tree, ['checkout', 'HEAD', '--', path]);
    else {
      await git(tree, ['rm', '-q', '--cached', '--ignore-unmatch', '--', path]);
      await rm(`${tree}/${path}`, { force: true });
    }
  }
}

/** Merges `branch` into `target` in the checkout that has `target` checked out; returns false on conflict */
export async function mergeInto(checkout: string, branch: string, message: string): Promise<boolean> {
  try {
    await git(checkout, [...IDENTITY, 'merge', '--no-ff', '-m', message, branch]);
    return true;
  } catch {
    await git(checkout, ['merge', '--abort']).catch(() => {});
    return false;
  }
}

/**
 * Merges `branch` into `target` without touching a working tree, keeping `keepDir` as it is on `target`
 * (knowledge-base changes reach the main line through the feed, not through the merge).
 * Returns the merge commit, or null when the branch cannot be merged.
 */
export async function mergeKeeping(
  repo: string,
  target: string,
  branch: string,
  keepDir: string,
  message: string,
): Promise<{ commit: string; changed: string[] } | null> {
  const parent = await head(repo, `refs/heads/${target}`);
  const tip = await head(repo, `refs/heads/${branch}`);
  let merged: string;
  try {
    merged = (await git(repo, ['merge-tree', '--write-tree', parent, tip])).split('\n')[0]!.trim();
  } catch {
    return null;
  }
  const tmpIndex = `${repo}/.git/momentum-merge-${process.pid}-${Date.now()}`;
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  const run = async (args: string[]) =>
    (await exec('git', args, { cwd: repo, env, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' })).stdout.trim();
  try {
    await run(['read-tree', merged]);
    await run(['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', keepDir]);
    const kept = (await git(repo, ['ls-tree', '-d', parent, '--', keepDir])).trim();
    if (kept) await run(['read-tree', `--prefix=${keepDir}/`, `${parent}:${keepDir}`]);
    const tree = await run(['write-tree']);
    const commit = await run([...IDENTITY, 'commit-tree', tree, '-p', parent, '-p', tip, '-m', message]);
    await git(repo, ['update-ref', `refs/heads/${target}`, commit, parent]);
    const changed = (await changes(repo, parent, commit)).map((c) => c.path);
    await syncCheckedOut(repo, target, parent, changed);
    return { commit, changed };
  } finally {
    await rm(tmpIndex, { force: true });
  }
}

export async function isMerged(repo: string, branch: string, into: string): Promise<boolean> {
  try {
    await git(repo, ['merge-base', '--is-ancestor', `refs/heads/${branch}`, `refs/heads/${into}`]);
    return true;
  } catch {
    return false;
  }
}

/** Changes of the working tree against `base`, committed or not, including untracked files */
export async function workingChanges(cwd: string, base: string): Promise<Change[]> {
  const tracked = (await git(cwd, ['diff', '--name-status', '--no-renames', base]))
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status: (status?.[0] ?? 'M') as Change['status'], path: path ?? '' };
    });
  const untracked = (await git(cwd, ['ls-files', '--others', '--exclude-standard']))
    .split('\n')
    .filter(Boolean)
    .map((path) => ({ status: 'A' as const, path }));
  return [...tracked, ...untracked];
}
