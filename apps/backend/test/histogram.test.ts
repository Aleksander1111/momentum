import { describe, expect, it } from 'vitest';
import { histogram } from '../src/metrics.ts';

describe('run histograms', () => {
  it('bins from zero past the largest value in a round width', () => {
    const h = histogram(
      [
        { automation: 'chat', v: 0 },
        { automation: 'chat', v: 2.4 },
        { automation: 'graph-build', v: 11.9 },
        { automation: 'graph-build', v: 1 },
      ],
      'real',
    );
    expect(h.edges).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(h.automations.find((a) => a.automation === 'chat')?.counts.slice(0, 3)).toEqual([1, 0, 1]);
    expect(h.automations.find((a) => a.automation === 'graph-build')?.counts).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('steps time through whole minutes and counts through whole numbers', () => {
    expect(histogram([{ automation: 'chat', v: 3000 }], 'seconds').edges[1]).toBe(300);
    expect(histogram([{ automation: 'chat', v: 5 }], 'count').edges).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps one bin when nothing ran or everything is zero', () => {
    expect(histogram([], 'real')).toEqual({ edges: [0, 1], automations: [] });
  });
});
