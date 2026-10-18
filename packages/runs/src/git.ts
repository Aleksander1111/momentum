import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

/** Files a commit was to change changed on the branch meanwhile: writing them now would undo what landed there */
export class PathsChanged extends Error {
  constructor(readonly paths: string[]) {
    super(`${paths.join(', ')} changed meanwhile`);
  }
}

const OPTIONS = { maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' } as const;

/** How long a command waits for a lock another git process holds (an editor's status poll, the user's own git) */
const LOCK_WAIT_MS = 5000;

export async function git(cwd: string, args: string[], input?: string): Promise<string> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (let attempt = 1; ; attempt++) {
    try {
      const child = exec('git', args, { cwd, ...OPTIONS });
      if (input !== undefined) {
        child.child.stdin?.end(input);
      }
      const { stdout } = await child;
      return stdout;
    } catch (e) {
      const err = e as { stderr?: string; message: string };
      if (/\.lock'?: File exists/.test(err.stderr ?? '') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
      throw new GitError(`git ${args.join(' ')}: ${err.stderr?.trim() || err.message}`, err.stderr ?? '');
    }
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

/**
 * What keeps a repository from being one straight line in one working directory: a detached HEAD, any branch besides
 * the one checked out, a worktree besides its own working directory, and merge commits on it since `since`. Work happens
 * on one line in one place, one change after another; none of these is allowed.
 */
export async function nonLinear(repo: string, since?: string | null): Promise<string[]> {
  const reasons: string[] = [];
  const line = await currentBranch(repo).catch(() => null);
  if (!line) reasons.push('its HEAD is detached from any branch');
  const branches = (await git(repo, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])).split('\n').map((b) => b.trim()).filter(Boolean);
  // Detached, the one branch there is is the line it left, not a second one
  const others = line ? branches.filter((b) => b !== line) : branches.length > 1 ? branches : [];
  if (others.length > 0) reasons.push(`it has ${others.length === 1 ? 'a branch' : 'branches'} besides ${line ?? 'its line'}: ${others.join(', ')}`);
  const linked = await linkedWorktrees(repo);
  if (linked.length > 0) reasons.push(`it has ${linked.length === 1 ? 'a worktree' : 'worktrees'} besides its working directory: ${linked.join(', ')}`);
  if (since && line) {
    const merges = await mergesBetween(repo, since, `refs/heads/${line}`);
    if (merges.length > 0) reasons.push(`merge commits landed on ${line}: ${merges.map((m) => m.slice(0, 7)).join(', ')}`);
  }
  return reasons;
}

/** Merge commits reachable from `to` and not from `from` */
export async function mergesBetween(repo: string, from: string, to: string): Promise<string[]> {
  return (await git(repo, ['rev-list', '--merges', `${from}..${to}`])).split('\n').filter(Boolean);
}

/**
 * What a run leaves is read as the repository keeps its text: a run on Windows may write a file back with CRLF, which
 * would change every line of it. Files the repository holds with CRLF stay so.
 */
const AS_STORED = ['-c', 'core.autocrlf=input'];

/** Whether the working tree has no change, committed or not, against HEAD */
export async function isClean(cwd: string): Promise<boolean> {
  return !(await git(cwd, [...AS_STORED, 'status', '--porcelain'])).trim();
}

/** Directories of the repository's linked worktrees, besides its own working directory */
async function linkedWorktrees(repo: string): Promise<string[]> {
  const out = await git(repo, ['worktree', 'list', '--porcelain']);
  const dirs = out
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim());
  return dirs.slice(1);
}

/**
 * Commits that change the main line of one repository go one after another: a run's commit and a reaction committed
 * meanwhile never read the same index or the same tip
 */
const committing = new Map<string, Promise<unknown>>();
function oneAtATime<T>(repo: string, fn: () => Promise<T>): Promise<T> {
  const key = resolve(repo).toLowerCase();
  const next = (committing.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
  committing.set(key, next);
  void next
    .finally(() => {
      if (committing.get(key) === next) committing.delete(key);
    })
    .catch(() => {});
  return next;
}

const IDENTITY = ['-c', 'user.name=Momentum', '-c', 'user.email=momentum@localhost'];
const ADD = [...AS_STORED, 'add', '-A'];

/** Commits everything in the working directory; returns the new commit, or null when nothing changed */
export async function commitAll(cwd: string, message: string): Promise<string | null> {
  await git(cwd, ADD);
  if (await isClean(cwd)) return null;
  await git(cwd, [...IDENTITY, 'commit', '-q', '-m', message]);
  return head(cwd);
}

/** Where a run leaves the commit message for its changes: the repository's git directory, so it is never committed */
export async function messageFile(cwd: string): Promise<string> {
  return resolve(cwd, (await git(cwd, ['rev-parse', '--git-path', 'MOMENTUM_MSG'])).trim());
}

/**
 * The tree the working directory would commit, untracked files included, without touching its index: the same tree for
 * the same changes. A copy of the index keeps its stat cache, so unchanged files are not hashed again.
 */
export async function workingTree(cwd: string): Promise<string> {
  const index = join(tmpdir(), `momentum-index-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    await copyFile(resolve(cwd, (await git(cwd, ['rev-parse', '--git-path', 'index'])).trim()), index);
    await exec('git', ADD, { cwd, env, ...OPTIONS });
    return (await exec('git', ['write-tree'], { cwd, env, ...OPTIONS })).stdout.trim();
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

/** Files moved between two commits, with how much of their content stayed the same (100: moved as they were) */
export async function moves(cwd: string, from: string, to: string): Promise<{ from: string; to: string; similarity: number }[]> {
  const out = await git(cwd, ['diff', '--name-status', '-M', '--diff-filter=R', from, to]);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, source, target] = line.split('\t');
      return { from: source ?? '', to: target ?? '', similarity: Number(status?.slice(1) ?? 0) };
    });
}

export async function show(cwd: string, ref: string, path: string): Promise<string | null> {
  try {
    return await git(cwd, ['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

/**
 * Puts a file of a working directory back as `source` (a commit or a tree) has it: its content there, or gone when it
 * had none there. The index is left as it is.
 */
export async function restorePath(cwd: string, source: string, path: string): Promise<void> {
  if ((await git(cwd, ['ls-tree', '--name-only', source, '--', path])).trim()) {
    await git(cwd, ['restore', `--source=${source}`, '--worktree', '--', path]);
    return;
  }
  await rm(join(cwd, path), { force: true });
}

/** Commits that changed a file, newest first, up to `ref` */
export async function fileHistory(cwd: string, ref: string, path: string): Promise<string[]> {
  const out = await git(cwd, ['log', '--format=%H', ref, '--', path]);
  return out.split('\n').filter(Boolean);
}

/** The message of the last commit up to `ref` that changed a file, or added or deleted it; empty when none did */
export async function lastCommitMessage(cwd: string, ref: string, path: string): Promise<string> {
  const out = await git(cwd, ['log', '-1', '--format=%B', ref, '--', path]);
  return out.trim();
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
 * Commits the given file contents onto `targetBranch` without touching the working directory's index or files first;
 * then brings the files up to date in the working directory, which has the branch checked out
 */
export function commitPathsFrom(
  repo: string,
  targetBranch: string,
  files: { path: string; content: string | null }[],
  message: string,
): Promise<string> {
  return oneAtATime(repo, async () => {
    const first = await head(repo, `refs/heads/${targetBranch}`);
    let parent = first;
    // The user may commit while this commit is built: built again on the new tip, unless they touched these files
    for (let attempt = 0; ; attempt++) {
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
        const moved = await git(repo, ['update-ref', `refs/heads/${targetBranch}`, commit, parent]).then(
          () => false,
          (e) => {
            if (attempt >= 4) throw e;
            return true;
          },
        );
        if (!moved) {
          await followInWorkingDir(repo, targetBranch, parent, files.map((f) => f.path));
          return commit;
        }
      } finally {
        await done();
      }
      const tip = await head(repo, `refs/heads/${targetBranch}`);
      const ours = new Set(files.map((f) => f.path));
      const touched = (await changes(repo, first, tip)).map((c) => c.path).filter((p) => ours.has(p));
      if (touched.length > 0) throw new PathsChanged(touched);
      parent = tip;
    }
  });
}

/**
 * Brings the files a commit made beside the working directory up to date in it, when it has `branch` checked out. A
 * file as the previous commit had it takes the new content; one with changes of its own keeps them, with the commit's
 * change merged in beside them, its own side where both changed the same lines. The index follows the commit either way.
 */
async function followInWorkingDir(repo: string, branch: string, previous: string, paths: string[]): Promise<void> {
  if ((await currentBranch(repo).catch(() => null)) !== branch) return;
  for (const path of paths) {
    const file = join(repo, path);
    const dirty = (await git(repo, [...AS_STORED, 'diff', '--name-only', previous, '--', path])).trim();
    const untracked = (await git(repo, ['ls-files', '--others', '--exclude-standard', '--', path])).trim();
    const now = await show(repo, 'HEAD', path);
    if (!dirty && !untracked) {
      if (now !== null) await git(repo, ['checkout', 'HEAD', '--', path]);
      else {
        await git(repo, ['rm', '-q', '--cached', '--ignore-unmatch', '--', path]);
        await rm(file, { force: true });
      }
      continue;
    }
    if (now !== null && existsSync(file)) {
      await writeFile(file, await mergeText(repo, await readFile(file, 'utf8'), (await show(repo, previous, path)) ?? '', now));
    }
    await git(repo, ['reset', '-q', 'HEAD', '--', path]);
  }
}

/** A three-way merge of one text, `ours` winning where both sides changed the same lines; the line endings stay ours */
async function mergeText(repo: string, ours: string, base: string, theirs: string): Promise<string> {
  const lf = (s: string) => s.replace(/\r\n/g, '\n');
  const dir = join(tmpdir(), `momentum-merge-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  try {
    const [o, b, t] = [join(dir, 'ours'), join(dir, 'base'), join(dir, 'theirs')];
    await writeFile(o, lf(ours));
    await writeFile(b, lf(base));
    await writeFile(t, lf(theirs));
    const merged = (await gitStatus(repo, ['merge-file', '-p', '--ours', o, b, t])).stdout;
    return ours.includes('\r\n') ? merged.replace(/\n/g, '\r\n') : merged;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface Landed {
  commit: string;
  /** Files the main line changed by this landing */
  changed: string[];
}

/**
 * What a run changed in the repository's working directory, committed onto the main line there as one commit; null
 * when it changed nothing. `since` is the working directory as the run found it (`workingTree`): only the files that
 * differ from it are the run's, and whatever else is left uncommitted there stays as it is. Without it, everything is.
 * The working directory has the main line checked out: it is the only place a run works.
 */
export function land(repo: string, main: string, message: string, since: string | null = null): Promise<Landed | null> {
  return oneAtATime(repo, async () => {
    const line = await currentBranch(repo).catch(() => null);
    if (line !== main) throw new GitError(`${repo} does not have ${main} checked out${line ? `; it is on ${line}` : ''}`, '');
    const before = await head(repo);
    const commit = since === null ? await commitAll(repo, message) : await commitPaths(repo, (await changedSince(repo, since)).map((c) => c.path), message);
    if (!commit) return null;
    return { commit, changed: (await changes(repo, before, commit)).map((c) => c.path) };
  });
}

/** Commits these paths of the working directory as they stand, and nothing else; null when they hold no change */
async function commitPaths(cwd: string, paths: string[], message: string): Promise<string | null> {
  if (paths.length === 0) return null;
  const list = `${paths.join('\n')}\n`;
  await git(cwd, [...AS_STORED, 'add', '-A', '--pathspec-from-file=-'], list);
  const staged = new Set((await git(cwd, ['diff', '--cached', '--name-only', '--no-renames'])).split('\n').filter(Boolean));
  if (!paths.some((p) => staged.has(p))) return null;
  await git(cwd, [...IDENTITY, 'commit', '-q', '-m', message, '--pathspec-from-file=-'], list);
  return head(cwd);
}

/**
 * What a run changed in the working directory: the files that differ from `since`, the working directory as the run
 * found it, and are not on the main line as they stand. Changes left there before the run, by the user or a session of
 * theirs, are not the run's; nor is a reaction the harness committed meanwhile, which the working directory took.
 */
export async function changedSince(cwd: string, since: string): Promise<Change[]> {
  const now = await workingTree(cwd);
  const offMain = new Set((await changes(cwd, 'HEAD', now)).map((c) => c.path));
  return (await changes(cwd, since, now)).filter((c) => offMain.has(c.path));
}

/** Changes of the working tree against `base`, committed or not, including untracked files */
export async function workingChanges(cwd: string, base: string): Promise<Change[]> {
  const tracked = (await git(cwd, [...AS_STORED, 'diff', '--name-status', '--no-renames', base]))
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
