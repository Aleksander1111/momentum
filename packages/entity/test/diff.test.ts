import type { Block, Card, Inline } from '@momentum/contract';
import { describe, expect, it } from 'vitest';
import { diffCards, pickable, toCard } from '../src/index.ts';

const fence = (src: string) => '```plantuml\n' + src + '\n```';

async function diff(before: string, after: string) {
  return diffCards('T', await toCard(before), 'T', await toCard(after));
}

function marked(c: Inline[] | Card, kind: 'ins' | 'del'): string[] {
  const out: string[] = [];
  const text = (n: Inline[]): string => n.map((i) => ('v' in i ? i.v : 'c' in i ? text(i.c) : '')).join('');
  const walk = (nodes: (Inline | Block)[]) => {
    for (const n of nodes) {
      if (n.t === kind && 'c' in n && (n.c as { t: string }[]).every((x) => !['p', 'list', 'table', 'diagram', 'quote', 'h', 'code'].includes(x.t) || 'v' in x)) {
        out.push(text(n.c as Inline[]));
      } else if ('c' in n && Array.isArray(n.c)) walk(n.c as (Inline | Block)[]);
      if ('items' in n) n.items.forEach(walk);
      if ('rows' in n) [n.head, ...n.rows].forEach((r) => r.forEach(walk));
    }
  };
  walk(c);
  return out;
}

describe('diffCards', () => {
  it('pairs a diagram across added prose and keeps its before version', async () => {
    const d = await diff(`# Domain\n\n${fence('rectangle old')}\n`, `# Domain\n\nEdge labels name the service.\n\n${fence('rectangle new')}\n`);
    const diagrams = d.card.filter((b) => b.t === 'diagram');
    expect(diagrams).toHaveLength(1);
    const g = diagrams[0] as Block & { t: 'diagram' };
    expect(g.before?.source).toMatch(/rectangle old/);
    expect(g.source).toMatch(/rectangle new/);
    expect(g.diff?.filter((s) => s.k === 'del').map((s) => s.v).join('')).toBe('old');
    expect(g.diff?.filter((s) => s.k === 'ins').map((s) => s.v).join('')).toBe('new');
    expect(d.card.filter((b) => b.t === 'ins')).toHaveLength(1);
    expect(d.card.filter((b) => b.t === 'del')).toHaveLength(0);
  });

  it('does not pair a new titled diagram with the next edited one', async () => {
    const before = `**Align**\n\n${fence('title align-before')}\n`;
    const after = `**Running jobs**\n\n${fence('title running-jobs')}\n\n**Align**\n\n${fence('title align-after')}\n`;
    const d = await diff(before, after);
    const added = d.card.filter((b) => b.t === 'ins').flatMap((b) => (b as { c: Block[] }).c);
    expect(added.some((b) => b.t === 'diagram' && b.source.includes('running-jobs'))).toBe(true);
    const edited = d.card.filter((b): b is Block & { t: 'diagram' } => b.t === 'diagram');
    expect(edited).toHaveLength(1);
    expect(edited[0]!.before?.source).toMatch(/align-before/);
    expect(edited[0]!.source).toMatch(/align-after/);
  });

  it('marks each phrase swap in a list item and leaves the middle unmarked', async () => {
    const before =
      '- Along a chain jobs do not overlap.\n- Output storage accumulates: the forecast output of every queued and running job is counted against free disk. A job whose forecast output does not fit stays `QUEUED`.\n';
    const after =
      '- Along a chain jobs do not overlap.\n- Output storage accumulates: the output storage of every queued and running job is counted against free disk. A job whose output storage does not fit stays `QUEUED`.\n';
    const d = await diff(before, after);
    const dels = marked(d.card, 'del');
    const inss = marked(d.card, 'ins');
    expect(dels.length).toBeGreaterThanOrEqual(2);
    expect(inss.length).toBeGreaterThanOrEqual(2);
    for (const t of [...dels, ...inss]) expect(t.includes('of every queued')).toBe(false);
    expect(d.removed).toBeGreaterThan(0);
    expect(d.added).toBeGreaterThan(0);
  });

  it('marks a rewritten list item as one replace and keeps the shared link', async () => {
    const before = '- First stays.\n- What the bus pushes has the same payload shape as the endpoint — [contracts](contracts.md).\n';
    const after = '- First stays.\n- A push is a change document whose inner values use shared types, not a copy — [contracts](contracts.md).\n';
    const d = await diff(before, after);
    const dels = marked(d.card, 'del');
    const inss = marked(d.card, 'ins');
    expect(dels).toHaveLength(1);
    expect(inss).toHaveLength(1);
    expect(dels[0]).toMatch(/What the bus pushes/);
    expect(inss[0]).toMatch(/change document/);
    const list = d.card.find((b) => b.t === 'list') as Block & { t: 'list' };
    expect(list.marks).toEqual([null, null]);
  });

  it('marks added and removed table rows and edits a row keeping its first cell', async () => {
    const before = '| Name | Value |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n| c | 3 |\n';
    const after = '| Name | Value |\n| --- | --- |\n| a | 1 |\n| b | 20 |\n| d | 4 |\n';
    const d = await diff(before, after);
    const t = d.card[0] as Block & { t: 'table' };
    expect(t.t).toBe('table');
    expect(t.marks).toEqual([null, null, 'del', 'ins']);
    expect(marked([{ t: 'p', c: t.rows[1]![1]! }], 'ins')).toEqual(['20']);
  });

  it('marks whole blocks added and removed and leaves equal ones alone', async () => {
    const d = await diff('Kept paragraph.\n\nGone paragraph here.\n', 'Kept paragraph.\n\n```\nnew code\n```\n');
    expect(d.card[0]).toEqual({ t: 'p', c: [{ t: 'text', v: 'Kept paragraph.' }] });
    expect(d.card.map((b) => b.t)).toEqual(['p', 'del', 'ins']);
  });

  it('diffs a changed title', () => {
    const d = diffCards('Old name', [], 'New name', []);
    expect(marked(d.title!, 'del')).toEqual(['Old']);
    expect(marked(d.title!, 'ins')).toEqual(['New']);
  });

  it('marks changed code lines inside', async () => {
    const d = await diff('```ts\nconst a = 1;\nconst b = 2;\n```\n', '```ts\nconst a = 1;\nconst b = 3;\n```\n');
    const code = d.card[0] as Block & { t: 'code' };
    expect(code.diff?.filter((s) => s.k !== 'eq')).toEqual([
      { k: 'del', v: '2' },
      { k: 'ins', v: '3' },
    ]);
  });
});

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" data-diagram-type="DESCRIPTION" height="203px" viewBox="0 0 282 203" width="282px"><?plantuml 1.2026.6?><defs/><g>' +
  '<g class="entity" data-qualified-name="User" id="ent0001"><ellipse cx="21.9551" cy="14" rx="8" ry="8"/><text font-size="14" textLength="31.9" x="6" y="78.49">User</text></g>' +
  '<g class="entity" data-qualified-name="Feed" id="ent0002"><rect height="46.3" width="74.17" x="111.87" y="20.5"/><text font-size="14" textLength="34.17" x="126.87" y="53.5">Feed</text></g>' +
  '<g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3"><path d="M38.3,43.64 C56.72,43.64 82.28,43.64 106.62,43.64" fill="none"/></g>' +
  '<rect height="20" width="40" x="200" y="150"/><text font-size="13" textLength="20" x="205" y="165">note &amp; more</text>' +
  '</g></svg>';

describe('pickable', () => {
  it('names entities, unlabelled arrows by their ends, and groups bare shapes as decorations', () => {
    const { svg, elements } = pickable(SVG);
    expect(elements.map((e) => e.name)).toEqual(['User', 'Feed', 'User → Feed', 'note & more']);
    expect(svg).toContain('<g class="decoration" data-pick="3"><rect');
    expect(svg).toContain('id="ent0002" data-pick="1">');
    const [x, y, w, h] = elements[1]!.box;
    expect(x).toBeCloseTo(111.87);
    expect(y).toBeCloseTo(20.5);
    expect(w).toBeCloseTo(74.17);
    expect(h).toBeCloseTo(46.3);
  });

  it('leaves out an SVG it cannot read, since it cannot make it safe', () => {
    expect(pickable('<svg><g></svg>')).toEqual({ svg: '', elements: [] });
    expect(pickable('<html><script>alert(1)</script></html>')).toEqual({ svg: '', elements: [] });
  });

  it('drops what runs code or leaves the page, and keeps the drawing and its web links', () => {
    const { svg } = pickable(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><script>alert(1)</script>' +
        '<g><a href="javascript:alert(1)" xlink:href="javascript:alert(1)"><text x="1" y="1">bad</text></a>' +
        '<a href="https://example.com/doc" target="_top"><text x="1" y="2">good</text></a>' +
        '<rect onclick="alert(1)" onmouseover="alert(2)" width="1" height="1"/><foreignObject><div>x</div></foreignObject>' +
        '<use href="https://evil.example/x.svg#a"/><use href="#local"/><image href="data:image/png;base64,AAAA"/>' +
        '<image href="data:image/svg+xml;base64,AAAA"/></g></svg>',
    );
    expect(svg).not.toMatch(/<script|javascript:|onclick|onmouseover|foreignObject|evil\.example|svg\+xml/i);
    expect(svg).toContain('<a href="https://example.com/doc" target="_top">');
    expect(svg).toContain('<a><text x="1" y="1">bad</text></a>');
    expect(svg).toContain('<rect width="1" height="1"/>');
    expect(svg).toContain('<use href="#local"/>');
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
  });
});
