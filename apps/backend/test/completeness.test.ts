import { describe, expect, it } from 'vitest';
import { measureCompleteness, SLOTS } from '../src/completeness.ts';

const ALL = ['Product/Product', 'Product/Goal', 'Product/Capability', 'Architecture/System', 'Code/Repository', 'Infrastructure/Environment', 'Testing/TestSuite', 'Governance/Decision'];

const files = [
  'package.json',
  'README.md',
  'apps/backend/package.json',
  'apps/backend/src/a.ts',
  'apps/backend/test/a.test.ts',
  'apps/app/src/b.tsx',
  'docs/guide.md',
  'docs/deck/slide.md',
  'examples/handbook/README.md',
  'examples/todo-cli/cli.js',
  'knowledge-graph/Product/Product/x.md',
  'chats/2026/one.md',
];

describe('completeness of the knowledge graph', () => {
  it('is the mean of the questions answered and the repository accounted for', () => {
    const c = measureCompleteness(files, [], []);
    expect(c.understanding.score).toBe(0);
    expect(c.territory.score).toBe(0);
    expect(c.score).toBe(0);
    expect(c.understanding.slots).toHaveLength(SLOTS.length);
    expect(c.detail).toBe(0);
  });

  it('counts an area by its parts, not its files, and lets a directory listed claim all in it', () => {
    const c = measureCompleteness(
      files,
      [
        { artifact: 'examples', type: 'Code/Repository' },
        { artifact: 'apps/backend/src/a.ts', type: 'Architecture/Component' },
        { artifact: 'docs/guide.md', type: 'Knowledge/HowToGuide' },
      ],
      ['Code/Repository', 'Architecture/Component', 'Knowledge/HowToGuide'],
    );
    const by = Object.fromEntries(c.territory.areas.map((a) => [a.path, a]));
    // A directory holding only directories stands for its children; the harness's own directories are nobody's to cover
    expect(Object.keys(by).sort()).toEqual(['.', 'apps/app', 'apps/backend', 'docs', 'examples/handbook', 'examples/todo-cli']);
    expect(by['examples/handbook']).toMatchObject({ score: 1, missing: [] });
    expect(by['examples/todo-cli']).toMatchObject({ score: 1, missing: [] });
    // One of three parts of apps/backend: src claimed through a file in it; test and the files directly in it not
    expect(by['apps/backend']).toMatchObject({ score: 1 / 3, missing: ['apps/backend/test', 'apps/backend/*'] });
    expect(by['docs']).toMatchObject({ score: 0.5, missing: ['docs/deck'] });
    expect(by['.']).toMatchObject({ score: 0, missing: ['./*'] });
    expect(by['apps/app']).toMatchObject({ score: 0, missing: ['apps/app/src'] });
    // Weighted by the logarithm of each area's file count: two root files, one in apps/app, three in apps/backend, two in docs, one in each example
    const w = [Math.log2(3), Math.log2(2), Math.log2(4), Math.log2(3), Math.log2(2), Math.log2(2)];
    const scores = [0, 0, 1 / 3, 0.5, 1, 1];
    expect(c.territory.score).toBeCloseTo(scores.reduce((s, v, i) => s + v * w[i]!, 0) / w.reduce((s, v) => s + v, 0));
  });

  it('fills a question by any of its types, and lets implementation detail claim nothing', () => {
    const c = measureCompleteness(
      ['README.md', 'src/a.ts'],
      [
        { artifact: 'src/a.ts', type: 'Code/SourceFile' },
        { artifact: 'README.md', type: 'Product/Product' },
      ],
      ['Product/Product', 'Code/SourceFile', 'Product/Capability'],
    );
    expect(c.understanding.slots.find((s) => s.name === 'What it does')?.filled).toBe(true);
    expect(c.understanding.slots.find((s) => s.name === 'What it is for')?.filled).toBe(false);
    expect(c.understanding.score).toBe(2 / SLOTS.length);
    expect(c.territory.areas).toEqual([
      { path: '.', score: 1, missing: [] },
      { path: 'src', score: 0, missing: ['src/*'] },
    ]);
    expect(c.detail).toBe(1);
  });

  it('leaves what the user excludes out of the territory, and is whole once everything is claimed', () => {
    const c = measureCompleteness(['README.md', 'src/a.ts', 'vendor/lib.js', 'build/out.js'], [{ artifact: 'README.md', type: 'Code/Repository' }, { artifact: 'src', type: 'Architecture/System' }], ALL, ['vendor/**', 'build/**']);
    expect(c.territory.areas.map((a) => a.path)).toEqual(['.', 'src']);
    expect(c.score).toBe(1);
  });

  it('reads Windows paths and trailing slashes as the same artifacts', () => {
    const c = measureCompleteness(['src\\a.ts', 'src\\b.ts'], [{ artifact: 'src/', type: 'Architecture/Component' }], []);
    expect(c.territory.score).toBe(1);
  });
});
