import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeName, typeOf } from '../src/attachments.ts';
import { config } from '../src/config.ts';
import { measureCompleteness } from '../src/completeness.ts';
import { graphBuildPrompt } from '../src/graph-build.ts';
import { namingQuestion, parseName } from '../src/naming.ts';
import { userPrompt, withAttachments, withContext } from '../src/runner.ts';
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
    const empty = measureCompleteness(['README.md', 'src/a.ts'], [], []);
    expect(graphBuildPrompt(null, 12, empty)).toMatch(/first graph build run: start from the top/);
    const next = graphBuildPrompt('Mapped src/api; next: src/store.', 3, empty);
    expect(next).toContain('Mapped src/api; next: src/store.');
    expect(next).toMatch(/at most 3 entities this run/);
    expect(next).toMatch(/report_graph_build/);
  });

  it('writes without a limit when the build runs in full', () => {
    const empty = measureCompleteness(['README.md', 'src/a.ts'], [], []);
    const prompt = graphBuildPrompt('Mapped src/api; next: src/store.', null, empty);
    expect(prompt).toContain('The build runs in full');
    expect(prompt).not.toMatch(/at most \d+ entities/);
    expect(prompt).toMatch(/report_graph_build/);
  });

  it('is told what the measure finds missing, and that nothing is once it is', () => {
    const half = measureCompleteness(['README.md', 'src/a.ts', 'examples/x/a.md'], [{ artifact: 'src', type: 'Architecture/Component' }], ['Product/Product']);
    const prompt = graphBuildPrompt(null, 5, half);
    expect(prompt).toMatch(/The harness measures the graph \d+% complete/);
    expect(prompt).toContain('- What it is for: Product/Goal');
    expect(prompt).toContain('- examples/x (0%: examples/x/*)');
    expect(prompt).toContain('- . (0%: ./*)');
    expect(prompt).not.toContain('- src');
    const types = ['Product/Product', 'Product/Goal', 'Product/Feature', 'Architecture/System', 'Code/Repository', 'Infrastructure/Environment', 'Testing/TestSuite', 'Governance/Decision'];
    const whole = measureCompleteness(['README.md', 'src/a.ts'], [{ artifact: 'README.md', type: 'Code/Repository' }, { artifact: 'src', type: 'Architecture/System' }], types);
    expect(whole.score).toBe(1);
    expect(graphBuildPrompt('All done.', 5, whole)).toContain('Nothing is missing');
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

describe('files attached to a message', () => {
  it('names where each file is kept, after the card parts and ahead of the message', () => {
    const shot = { id: '0123456789abcdef', name: 'error.png', type: 'image/png', size: 84 * 1024 };
    const log = { id: 'fedcba9876543210', name: 'server.log', type: 'text/plain', size: 2_400_000 };
    expect(withAttachments('shop', [], 'Why?')).toBe('Why?');
    const one = withAttachments('shop', [shot], 'Why?');
    expect(one).toContain('The user attached a file to this message; read it where it is:');
    expect(one).toContain(`- ${join(config.attachments, 'shop', shot.id, 'error.png')} (image/png, 84 KB)`);
    expect(one.endsWith('\n\nWhy?')).toBe(true);
    expect(withAttachments('shop', [shot, log], 'Why?')).toContain('2 files to this message; read them where they are:');
    expect(withAttachments('shop', [shot, log], 'Why?')).toContain('server.log (text/plain, 2.3 MB)');
    const card = { workspace: 'shop', path: 'Product/Feature/search', title: 'Search', heading: [] };
    const both = userPrompt('shop', [card], [shot], 'Why?');
    expect(both.indexOf('search.md')).toBeLessThan(both.indexOf('error.png'));
    expect(both.indexOf('error.png')).toBeLessThan(both.indexOf('Why?'));
  });

  it('keeps a file under a name Windows takes, typed by its extension', () => {
    expect(safeName('C:\\Users\\me\\Desktop\\shot.png')).toBe('shot.png');
    expect(safeName('../../etc/passwd')).toBe('passwd');
    expect(safeName('a<b>:c?.txt')).toBe('a_b__c_.txt');
    expect(safeName('notes. ')).toBe('notes');
    expect(safeName('..')).toBe('file');
    expect(safeName('')).toBe('file');
    expect(typeOf('Shot.PNG')).toBe('image/png');
    expect(typeOf('report.pdf')).toBe('application/pdf');
    expect(typeOf('data.bin')).toBe('application/octet-stream');
  });
});

describe('naming a chat', () => {
  it('asks for a name after what was done, from what was asked, answered and changed', () => {
    const q = namingQuestion(['what does it mean?'], ['Level 0 nodes are the consensus layer; the card says so now.'], ['Architecture/Component/level-0']);
    expect(q.system).toMatch(/never the question as the user asked it/);
    expect(q.prompt).toContain('# The user asked\n\nwhat does it mean?');
    expect(q.prompt).toContain('- Architecture/Component/level-0');
    expect(namingQuestion(['Hi'], ['Hello'], []).prompt).not.toContain('Entities it changed');
  });

  it('takes the first line of the answer, without quotes or a closing full stop', () => {
    expect(parseName('\n"Make level 0 nodes the consensus layer."\nBecause…')).toBe('Make level 0 nodes the consensus layer');
    expect(parseName('  ')).toBeNull();
    expect(parseName('x'.repeat(120))).toHaveLength(80);
  });
});
