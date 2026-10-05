import { execFileSync } from 'node:child_process';
import type { EntityDetail } from '@momentum/contract';
import { schemaOf } from '@momentum/kb';
import type { Env } from './env.ts';

/**
 * What runs landed, found from the main line and the harness's records rather than from what a script would have
 * written: a real model names its entities, files and commits its own way.
 */

/** The commits a run landed on the main line, oldest first */
export async function commitsOf(env: Env, ws: string, runId: string): Promise<string[]> {
  const rows = await env.sql<{ commit: string }[]>`select commit from ${env.sql(`${schemaOf(ws)}.transaction`)}
    where run_id = ${runId} and commit is not null order by created_at`;
  return rows.map((r) => r.commit);
}

/** The files the commits changed */
export function filesOf(env: Env, ws: string, commits: string[]): string[] {
  return [...new Set(commits.flatMap((c) => env.git(ws, 'show', '--name-only', '--format=', c).split('\n').filter(Boolean)))];
}

const entityPath = (file: string) => /^knowledge-graph\/(.+)\.md$/.exec(file)?.[1] ?? null;

/** Whether a file is on the main line, as the user's checkout follows it, whatever the line is called */
function onMainLine(env: Env, ws: string, file: string): boolean {
  try {
    env.git(ws, 'cat-file', '-e', `HEAD:${file}`);
    return true;
  } catch {
    return false;
  }
}

/** The entities a run's landed commits added or changed that are still on the main line */
export async function entitiesOf(env: Env, ws: string, runId: string): Promise<string[]> {
  return filesOf(env, ws, await commitsOf(env, ws, runId))
    .map(entityPath)
    .filter((p): p is string => !!p && onMainLine(env, ws, `knowledge-graph/${p}.md`));
}

/** The paths an entity references with a relation */
export const refs = (e: EntityDetail, relation: string) => e.references.filter((r) => r.direction === 'out' && r.relation === relation).map((r) => r.path);

/** What a Node.js module script prints, run in the user's checkout of the main line */
export function runNode(env: Env, ws: string, script: string): string {
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: env.path(ws), encoding: 'utf8', timeout: 60_000, windowsHide: true });
}

/** Whether the project's own tests pass on the main line, as the user's checkout has it */
export function testsPass(env: Env, ws: string): boolean {
  try {
    execFileSync(process.execPath, ['--test'], { cwd: env.path(ws), stdio: 'pipe', timeout: 120_000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
