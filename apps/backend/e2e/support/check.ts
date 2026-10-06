import { join } from 'node:path';
import { loadEntityTypes, parseEntity, validateEntity, type ValidationIssue } from '@momentum/entity';
import { REPO, type Env } from './env.ts';

const types = loadEntityTypes(join(REPO, 'docs', 'entity-types.tsv'));
const pathOf = (file: string) => file.replace(/^knowledge-graph\//, '').replace(/\.md$/, '');

/** What the guard would refuse in a project's knowledge graph as it stands on the main line */
export function graphIssues(env: Env, ws: string): ValidationIssue[] {
  const files = env.files(ws).filter((f) => f.endsWith('.md'));
  const paths = new Set(files.map(pathOf));
  return files.flatMap((f) => {
    try {
      return validateEntity(pathOf(f), parseEntity(env.show(ws, f)!), { types, resolves: (p) => paths.has(p) });
    } catch (e) {
      return [{ path: pathOf(f), code: 'parse' as const, message: (e as Error).message }];
    }
  });
}

/** The entity files a project's main line gained since a commit */
export function addedSince(env: Env, ws: string, commit: string): string[] {
  const out = env.git(ws, 'diff', '--name-only', '--diff-filter=A', commit, 'main', '--', 'knowledge-graph');
  return out ? out.split('\n') : [];
}
