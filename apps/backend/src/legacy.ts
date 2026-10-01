import { branchesUnder, deleteBranch, git, head, landCommit, removeWorktree, worktreeDirs } from '@momentum/runs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config.ts';
import type { Workspace } from './workspaces.ts';

/**
 * Runs once worked on branches of their own, `momentum/<automation>/<run-id>`, each in its own worktree. Everything
 * happens on the main line now: what those branches hold is landed on it, oldest first, the later landing winning a
 * conflict, and the branches and worktrees go. Nothing to do once no `momentum/` branch is left.
 */
export async function landRunBranches(ws: Workspace): Promise<{ landed: string[]; conflicts: string[] }> {
  const landed: string[] = [];
  const conflicts: string[] = [];
  const branches = (await branchesUnder(ws.path, 'momentum/')).filter((b) => b !== ws.main);
  if (branches.length === 0) return { landed, conflicts };
  const runs = resolve(config.runs, ws.name);
  const inRuns = (dir: string) => resolve(dir).toLowerCase().startsWith(runs.toLowerCase());
  for (const dir of (await worktreeDirs(ws.path)).filter(inRuns)) {
    await removeWorktree(ws.path, dir).catch((e) => console.error(`${ws.name}: worktree ${dir}:`, e));
  }
  await rm(runs, { recursive: true, force: true }).catch(() => {});
  for (const branch of branches) {
    const tip = await head(ws.path, `refs/heads/${branch}`);
    const merged = await git(ws.path, ['merge-base', '--is-ancestor', tip, `refs/heads/${ws.main}`]).then(() => true, () => false);
    if (!merged) {
      let result = null;
      for (let attempt = 0; attempt < 5 && !result; attempt++) {
        result = await landCommit(ws.path, ws.main, tip, `momentum: land ${branch}`);
      }
      if (!result) throw new Error(`${ws.name}: could not land ${branch}`);
      landed.push(branch);
      conflicts.push(...result.conflicts.map((c) => `${branch}: ${c}`));
    }
    await deleteBranch(ws.path, branch);
  }
  return { landed, conflicts };
}
