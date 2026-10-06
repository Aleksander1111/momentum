import { describe, expect, it } from 'vitest';
import { graphBuildPrompt } from '../src/graph-build.ts';
import { withContext } from '../src/runner.ts';
import { SequenceTracker } from '../src/voice/feed.ts';

describe('following the command stream', () => {
  it('waits for a snapshot, delivers in order, skips what it saw and resyncs over a hole', () => {
    const t = new SequenceTracker();
    expect(t.accept({ type: 'command', seq: 4 })).toBe('resync');
    expect(t.accept({ type: 'snapshot', seq: 4 })).toBe('deliver');
    expect(t.accept({ type: 'command', seq: 5 })).toBe('deliver');
    expect(t.accept({ type: 'command', seq: 5 })).toBe('skip');
    expect(t.accept({ type: 'command', seq: 3 })).toBe('skip');
    expect(t.accept({ type: 'partial' })).toBe('deliver');
    expect(t.accept({ type: 'stats', seq: 99 })).toBe('deliver');
    expect(t.accept({ type: 'command', seq: 7 })).toBe('resync');
    expect(t.seq).toBe(5);
    expect(t.accept({ type: 'snapshot', seq: 7 })).toBe('deliver');
    expect(t.accept({ type: 'command', seq: 8 })).toBe('deliver');
  });
});

describe('a graph build run', () => {
  it('starts from the top, or from where the last run left off, within the room the feed has', () => {
    expect(graphBuildPrompt(null, 12)).toMatch(/first graph build run: start from the top/);
    const next = graphBuildPrompt('Mapped src/api; next: src/store.', 3);
    expect(next).toContain('Mapped src/api; next: src/store.');
    expect(next).toMatch(/at most 3 entities this run/);
    expect(next).toMatch(/report_graph_build/);
  });
});

describe('parts of cards handed to a run', () => {
  it('puts each part ahead of the message, as the card file and the heading it sits under', () => {
    const quote = { workspace: 'shop', path: 'Product/Feature/search', title: 'Search', heading: ['Rules'], quote: 'Typos are forgiven.' };
    const element = { workspace: 'shop', path: 'Architecture/System/shop', title: 'Shop', heading: [], element: 'Checkout' };
    expect(withContext([], 'Why?')).toBe('Why?');
    const text = withContext([quote, element], 'Why?');
    expect(text).toContain('knowledge-graph/Product/Feature/search.md > Rules >\n\n... Typos are forgiven. ...');
    expect(text).toContain('knowledge-graph/Architecture/System/shop.md > < Checkout >');
    expect(text.endsWith('Why?')).toBe(true);
    expect(text.indexOf('search.md')).toBeLessThan(text.indexOf('shop.md'));
  });
});
