import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

const OPTIONS = { maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' } as const;

export async function git(cwd: string, args: string[], input?: string): Promise<string> {
  try {
    const child = exec('git', args, { cwd, ...OPTIONS });
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

/** Like git(), but a non-zero exit is an outcome, not an error: merge-tree exits 1 on conflicts */
async function gitStatus(cwd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string }> {
  try {
    const { stdout } = await exec('git', args, { cwd, env, ...OPTIONS });
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string; message: string };
    if (typeof err.code === 'number' && err.code > 0 && err.code < 128) return { code: err.code, stdout: err.stdout ?? '' };
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

/** Whether the working tree has no change, committed or not, against HEAD */
export async function isClean(cwd: string): Promise<boolean> {
  return !(await git(cwd, ['status', '--porcelain'])).trim();
}

/**
 * The run checkout of a workspace: one detached worktree, at the tip of the main line, where every run of the
 * workspace works one after another. Nothing is branched: what a run leaves lands on the main line when it ends.
 */
export async function ensureCheckout(repo: string, checkout: string, main: string): Promise<void> {
  if (existsSync(checkout)) return;
  await mkdir(dirname(checkout), { recursive: true });
  await git(repo, ['worktree', 'prune']);
  await git(repo, ['worktree', 'add', '--detach', checkout, `refs/heads/${main}`]);
}

/** Moves a clean checkout to a commit, so a run starts from the main line as it stands */
export async function moveCheckout(checkout: string, ref: string): Promise<void> {
  await git(checkout, ['checkout', '-q', '--detach', ref]);
}

export async function removeWorktree(repo: string, checkout: string): Promise<void> {
  // Twice --force: a worktree left locked by an interrupted add goes too, and so does its entry once the directory is gone
  if (existsSync(checkout)) await git(repo, ['worktree', 'remove', '--force', '--force', checkout]);
  else await git(repo, ['worktree', 'unlock', checkout]).catch(() => {});
  await git(repo, ['worktree', 'prune']);
}

/** Branches under a prefix, such as `momentum/`, oldest tip first */
export async function branchesUnder(repo: string, prefix: string): Promise<string[]> {
  const out = await git(repo, ['for-each-ref', '--sort=committerdate', '--format=%(refname:short)', `refs/heads/${prefix}`]);
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Directories of the repository's linked worktrees */
export async function worktreeDirs(repo: string): Promise<string[]> {
  const out = await git(repo, ['worktree', 'list', '--porcelain']);
  return out
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim());
}

export async function deleteBranch(repo: string, branch: string): Promise<void> {
  if (await branchExists(repo, branch)) await git(repo, ['branch', '-D', branch]);
}

const IDENTITY = ['-c', 'user.name=Momentum', '-c', 'user.email=momentum@localhost'];

/** Commits everything in the checkout; returns the new commit, or null when nothing changed */
export async function commitAll(checkout: string, message: string): Promise<string | null> {
  await git(checkout, ['add', '-A']);
  if (await isClean(checkout)) return null;
  await git(checkout, [...IDENTITY, 'commit', '-q', '-m', message]);
  return head(checkout);
}

/** Where a run leaves the commit message for its changes: the checkout's own git directory, so it is never committed */
export async function messageFile(checkout: string): Promise<string> {
  return resolve(checkout, (await git(checkout, ['rev-parse', '--git-path', 'MOMENTUM_MSG'])).trim());
}

/**
 * The tree the checkout would commit, untracked files included, without touching its index: the same tree for the
 * same changes. A copy of the index keeps its stat cache, so unchanged files are not hashed again.
 */
export async function workingTree(checkout: string): Promise<string> {
  const index = join(tmpdir(), `momentum-index-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    await copyFile(resolve(checkout, (await git(checkout, ['rev-parse', '--git-path', 'index'])).trim()), index);
    await exec('git', ['add', '-A'], { cwd: checkout, env, ...OPTIONS });
    return (await exec('git', ['write-tree'], { cwd: checkout, env, ...OPTIONS })).stdout.trim();
  } finally {
    await rm(index, { force: true });
  }
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

/** Commits that changed a file, newest first, up to `ref` */
export async function fileHistory(cwd: string, ref: string, path: string): Promise<string[]> {
  const out = await git(cwd, ['log', '--format=%H', ref, '--', path]);
  return out.split('\n').filter(Boolean);
}

export async function listFiles(cwd: string, ref: string, dir: string): Promise<string[]> {
  const out = await git(cwd, ['ls-tree', '-r', '--name-only', ref, '--', dir]);
  return out.split('\n').filter(Boolean);
}

export async function mergeBase(cwd: string, a: string, b: string): Promise<string> {
  return (await git(cwd, ['merge-base', a, b])).trim();
}

/** A git command against a temporary index, so no working tree is touched */
function withIndex(repo: string) {
  const tmpIndex = `${repo}/.git/momentum-index-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  const run = async (args: string[], input?: string) => {
    const child = exec('git', args, { cwd: repo, env, ...OPTIONS });
    if (input !== undefined) child.child.stdin?.end(input);
    return (await child).stdout.trim();
  };
  return { run, done: () => rm(tmpIndex, { force: true }) };
}

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
  const { run, done } = withIndex(repo);
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
    await done();
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

/** Files to land along with a commit whose changes conflicted: what the harness raises over the conflicts */
export type OnConflicts = (conflicts: string[]) => Promise<{ path: string; content: string }[]>;

export interface Landed {
  commit: string;
  /** Files whose changes conflicted with the main line; resolved in favour of the landing commit */
  conflicts: string[];
  /** Files the main line changed by this landing */
  changed: string[];
}

/**
 * Lands a commit on the main line without a branch: fast-forwarded when the main line has not moved since the
 * commit's base, replayed onto the new tip as one commit otherwise, so the history stays one line. A conflicting file
 * takes the landing side whole, and `onConflicts` may add files to the same commit. Returns null when the main line
 * moved while landing; the caller tries again.
 */
export async function landCommit(repo: string, main: string, tip: string, message: string, onConflicts?: OnConflicts): Promise<Landed | null> {
  const target = `refs/heads/${main}`;
  const current = await head(repo, target);
  const base = await mergeBase(repo, current, tip);
  if (base === current) {
    try {
      await git(repo, ['update-ref', target, tip, current]);
    } catch {
      return null;
    }
    const changed = (await changes(repo, current, tip)).map((c) => c.path);
    await syncCheckedOut(repo, main, current, changed);
    return { commit: tip, conflicts: [], changed };
  }
  const merged = await gitStatus(repo, ['merge-tree', '--write-tree', '--name-only', '--no-messages', `--merge-base=${base}`, current, tip]);
  if (merged.code > 1) throw new GitError(`git merge-tree: exit ${merged.code}`, '');
  const [treeLine, ...rest] = merged.stdout.split('\n');
  const mergedTree = treeLine!.trim();
  const conflicts = [...new Set(rest.map((l) => l.trim()).filter(Boolean))];
  const { run, done } = withIndex(repo);
  try {
    await run(['read-tree', mergedTree]);
    for (const path of conflicts) {
      const landing = await show(repo, tip, path);
      if (landing === null) {
        await run(['update-index', '--force-remove', '--', path]);
      } else {
        const blob = await run(['hash-object', '-w', '--stdin'], landing);
        await run(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
      }
    }
    for (const f of conflicts.length && onConflicts ? await onConflicts(conflicts) : []) {
      const blob = await run(['hash-object', '-w', '--stdin'], f.content);
      await run(['update-index', '--add', '--cacheinfo', `100644,${blob},${f.path}`]);
    }
    const tree = await run(['write-tree']);
    const commit = await run([...IDENTITY, 'commit-tree', tree, '-p', current, '-m', message]);
    try {
      await git(repo, ['update-ref', target, commit, current]);
    } catch {
      return null;
    }
    const changed = (await changes(repo, current, commit)).map((c) => c.path);
    await syncCheckedOut(repo, main, current, changed);
    return { commit, conflicts, changed };
  } finally {
    await done();
  }
}

/**
 * What a run left in the checkout, committed and landed on the main line; the checkout then stands at the landed
 * commit. Returns null when the run changed nothing.
 */
export async function land(repo: string, main: string, checkout: string, message: string, onConflicts?: OnConflicts): Promise<Landed | null> {
  const tip = await commitAll(checkout, message);
  if (!tip) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const landed = await landCommit(repo, main, tip, message, onConflicts);
    if (landed) {
      await git(checkout, ['reset', '-q', '--hard', landed.commit]);
      return landed;
    }
  }
  throw new GitError(`could not land ${tip} on ${main}: the main line kept moving`, '');
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
