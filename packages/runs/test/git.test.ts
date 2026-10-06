import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ensureCheckout, head, land, mergeBase, restorePath, show, workingChanges } from '../src/git.ts';

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
