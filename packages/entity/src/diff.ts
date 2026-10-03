import type { Block, Card, CardDiff, Inline, Mark, Span } from '@momentum/contract';

/**
 * The diff of a card against its last verified version, ported from the stock-fly-8 knowledge base: blocks are aligned
 * by content, a removed block pairs with an added one of the same title (or the only one of its kind under the same
 * heading, or one that swallowed its body), and a paired block is diffed inside: words of text, rows of tables, items
 * of lists, lines of code and of a diagram's source. A diagram keeps its before version for the Before/After tabs.
 */
export function diffCards(beforeTitle: string, before: Card, afterTitle: string, after: Card): CardDiff {
  const words = { removed: 0, added: 0 };
  const card = diffBlocks(before, after, words);
  let title: Inline[] | null = null;
  if (beforeTitle.trim() !== afterTitle.trim()) {
    title = inlineDiff([{ t: 'text', v: beforeTitle }], [{ t: 'text', v: afterTitle }]);
    count(words, beforeTitle, afterTitle);
  }
  return { title, card, removed: words.removed, added: words.added };
}

interface Words {
  removed: number;
  added: number;
}

interface Flat {
  block: Block;
  heading: string;
  /** A `**Title**` paragraph before the block, the bold lead of a list, or the heading a block is alone under */
  title: string | null;
}

type Op = { kind: 'equal'; before: Flat; after: Flat } | { kind: 'remove'; flat: Flat } | { kind: 'add'; flat: Flat };

function diffBlocks(before: Block[], after: Block[], words: Words): Block[] {
  const left = flatten(before);
  const right = flatten(after);
  const ops = lcs(left, right, (a, b) => sig(a.block) === sig(b.block));
  const out: Block[] = [];
  const removes: Flat[] = [];
  const adds: Flat[] = [];
  const flush = () => {
    out.push(...coalesce(removes, adds, words));
    removes.length = 0;
    adds.length = 0;
  };
  for (const op of ops) {
    if (op.kind === 'equal') {
      flush();
      out.push(op.after.block);
    } else if (op.kind === 'remove') {
      if (adds.length > 0) flush();
      removes.push(op.flat);
    } else {
      adds.push(op.flat);
    }
  }
  flush();
  return out;
}

function flatten(blocks: Block[]): Flat[] {
  const stack: { depth: number; text: string }[] = [];
  const flat: Flat[] = [];
  let pending: string | null = null;
  for (const block of blocks) {
    if (block.t === 'h') {
      while (stack.length > 0 && stack[stack.length - 1]!.depth >= block.depth) stack.pop();
      flat.push({ block, heading: stack.map((s) => s.text).join('\u0000'), title: plain(block.c) });
      stack.push({ depth: block.depth, text: plain(block.c) });
      pending = null;
      continue;
    }
    const heading = stack.map((s) => s.text).join('\u0000');
    const bold = boldTitle(block);
    const title = block.t === 'p' ? firstLine(block) : block.t === 'list' ? boldLead(block) ?? pending : pending;
    flat.push({ block, heading, title });
    pending = bold;
  }
  // A block alone of its kind under its heading is named by that heading
  for (const f of flat) {
    if (f.title !== null || f.block.t === 'p' || f.block.t === 'h') continue;
    const mates = flat.filter((g) => g.heading === f.heading && g.block.t !== 'p' && g.block.t !== 'h');
    if (mates.length === 1 && f.heading !== '') f.title = f.heading.split('\u0000').pop()!;
  }
  return flat;
}

/** A paragraph that is one bold run: the title of the block after it */
function boldTitle(block: Block): string | null {
  if (block.t !== 'p' || block.c.length !== 1 || block.c[0]!.t !== 'strong') return null;
  return plain(block.c) || null;
}

function boldLead(block: Block & { t: 'list' }): string | null {
  const first = block.items[0]?.[0];
  if (!first || first.t !== 'p' || first.c[0]?.t !== 'strong') return null;
  return plain([first.c[0]]).replace(/\.$/, '') || null;
}

function firstLine(block: Block & { t: 'p' }): string | null {
  return plain(block.c).split('\n', 1)[0]!.trim() || null;
}

function coalesce(removes: Flat[], adds: Flat[], words: Words): Block[] {
  const used = removes.map(() => false);
  const pairOf = adds.map(() => -1);
  adds.forEach((add, ai) => {
    const ri = bestRemoveFor(add, removes, adds, used);
    if (ri === -1) return;
    used[ri] = true;
    pairOf[ai] = ri;
  });
  const pairedAfter = adds.filter((_, ai) => pairOf[ai] !== -1).map((f) => text(f.block));
  const out: Block[] = [];
  removes.forEach((r, ri) => {
    if (used[ri]) return;
    if (r.block.t !== 'diagram' && pairedAfter.some((t) => containsBody(t, text(r.block)))) return;
    count(words, text(r.block), '');
    out.push({ t: 'del', c: [r.block] });
  });
  adds.forEach((a, ai) => {
    const ri = pairOf[ai]!;
    if (ri === -1) {
      count(words, '', text(a.block));
      out.push({ t: 'ins', c: [a.block] });
    } else {
      out.push(...changed(removes[ri]!.block, a.block, words));
    }
  });
  return out;
}

function bestRemoveFor(add: Flat, removes: Flat[], adds: Flat[], used: boolean[]): number {
  let best = -1;
  let bestScore = 0;
  let bestLength = -1;
  removes.forEach((r, ri) => {
    if (used[ri]) return;
    const score = pairScore(r, add, removes, adds);
    if (score === 0) return;
    const length = text(r.block).length;
    if (score > bestScore || (score === bestScore && length > bestLength)) {
      best = ri;
      bestScore = score;
      bestLength = length;
    }
  });
  return best;
}

function pairScore(removed: Flat, add: Flat, removes: Flat[], adds: Flat[]): number {
  if (removed.block.t === add.block.t && removed.title !== null && removed.title === add.title) return 2;
  // A diagram pairs by title or as the only diagram changed under its heading: cards rarely title their diagrams
  if (removed.block.t === 'diagram' || add.block.t === 'diagram') return soleSlot(removed, add, removes, adds) ? 1 : 0;
  if (containsBody(text(add.block), text(removed.block))) return 1;
  return soleSlot(removed, add, removes, adds) ? 1 : 0;
}

function soleSlot(removed: Flat, add: Flat, removes: Flat[], adds: Flat[]): boolean {
  if (removed.block.t !== add.block.t) return false;
  const key = slotKey(removed);
  if (key !== slotKey(add)) return false;
  return removes.filter((f) => slotKey(f) === key).length === 1 && adds.filter((f) => slotKey(f) === key).length === 1;
}

const slotKey = (f: Flat) => `${f.block.t}:${f.heading}`;

function containsBody(haystack: string, needle: string): boolean {
  const need = collapse(needle);
  return need.length > 0 && collapse(haystack).includes(need);
}

/** One removed and one added block shown as one, changes marked inside */
function changed(before: Block, after: Block, words: Words): Block[] {
  if (before.t === 'p' && after.t === 'p') {
    count(words, plain(before.c), plain(after.c));
    return [{ t: 'p', c: inlineDiff(before.c, after.c) }];
  }
  if (before.t === 'h' && after.t === 'h') {
    count(words, plain(before.c), plain(after.c));
    return [{ ...after, c: inlineDiff(before.c, after.c) }];
  }
  if (before.t === 'table' && after.t === 'table') return [tableDiff(before, after, words)];
  if (before.t === 'list' && after.t === 'list') return [listDiff(before, after, words)];
  if (before.t === 'quote' && after.t === 'quote') return [{ t: 'quote', c: diffBlocks(before.c, after.c, words) }];
  if (before.t === 'code' && after.t === 'code') {
    count(words, before.v, after.v);
    return [{ ...after, diff: lineDiff(before.v, after.v, wordMarks) }];
  }
  if (before.t === 'diagram' && after.t === 'diagram') {
    count(words, before.source, after.source);
    return [
      {
        ...after,
        before: { svg: before.svg, source: before.source, ...(before.elements ? { elements: before.elements } : {}) },
        diff: lineDiff(before.source, after.source, charMarks),
      },
    ];
  }
  count(words, text(before), text(after));
  return [
    { t: 'del', c: [before] },
    { t: 'ins', c: [after] },
  ];
}

// Tables: rows aligned by content; a row keeping its first cell is edited cell by cell, any other is removed or added

function tableDiff(before: Block & { t: 'table' }, after: Block & { t: 'table' }, words: Words): Block {
  const key = (row: Inline[][]) => row.map(plain).join('\u0000');
  const head = cellsDiff(before.head, after.head, words);
  const rows: Inline[][][] = [];
  const marks: (Mark | null)[] = [];
  const removed: Inline[][][] = [];
  const added: Inline[][][] = [];
  const flush = () => {
    let ri = 0;
    let ai = 0;
    while (ri < removed.length && ai < added.length) {
      if (plain(removed[ri]![0] ?? []) === plain(added[ai]![0] ?? [])) {
        rows.push(cellsDiff(removed[ri]!, added[ai]!, words));
        marks.push(null);
        ri++;
        ai++;
      } else {
        count(words, key(removed[ri]!), '');
        rows.push(removed[ri]!);
        marks.push('del');
        ri++;
      }
    }
    for (; ri < removed.length; ri++) {
      count(words, key(removed[ri]!), '');
      rows.push(removed[ri]!);
      marks.push('del');
    }
    for (; ai < added.length; ai++) {
      count(words, '', key(added[ai]!));
      rows.push(added[ai]!);
      marks.push('ins');
    }
    removed.length = 0;
    added.length = 0;
  };
  for (const op of lcs(before.rows, after.rows, (a, b) => key(a) === key(b))) {
    if (op.kind === 'equal') {
      flush();
      rows.push(op.after);
      marks.push(null);
    } else if (op.kind === 'remove') {
      if (added.length > 0) flush();
      removed.push(op.flat);
    } else {
      added.push(op.flat);
    }
  }
  flush();
  return { t: 'table', head, rows, marks };
}

function cellsDiff(before: Inline[][], after: Inline[][], words: Words): Inline[][] {
  const width = Math.max(before.length, after.length);
  return Array.from({ length: width }, (_, i) => {
    const l = before[i] ?? [];
    const r = after[i] ?? [];
    if (sig(l) === sig(r)) return r;
    count(words, plain(l), plain(r));
    return inlineDiff(l, r);
  });
}

// Lists: items aligned by their text; a removed and an added item in the same place are one edited item

function listDiff(before: Block & { t: 'list' }, after: Block & { t: 'list' }, words: Words): Block {
  const head = (item: Block[]) => sig(item[0] ?? null);
  const items: Block[][] = [];
  const marks: (Mark | null)[] = [];
  const removed: Block[][] = [];
  const added: Block[][] = [];
  const flush = () => {
    let ri = 0;
    let ai = 0;
    for (; ri < removed.length && ai < added.length; ri++, ai++) {
      items.push(itemDiff(removed[ri]!, added[ai]!, words));
      marks.push(null);
    }
    for (; ri < removed.length; ri++) {
      count(words, removed[ri]!.map(text).join(' '), '');
      items.push(removed[ri]!);
      marks.push('del');
    }
    for (; ai < added.length; ai++) {
      count(words, '', added[ai]!.map(text).join(' '));
      items.push(added[ai]!);
      marks.push('ins');
    }
    removed.length = 0;
    added.length = 0;
  };
  for (const op of lcs(before.items, after.items, (a, b) => head(a) === head(b))) {
    if (op.kind === 'equal') {
      flush();
      items.push(itemDiff(op.before, op.after, words));
      marks.push(null);
    } else if (op.kind === 'remove') {
      if (added.length > 0) flush();
      removed.push(op.flat);
    } else {
      added.push(op.flat);
    }
  }
  flush();
  return { t: 'list', ordered: after.ordered || before.ordered, items, marks };
}

/** An item's text diffed by words, its nested list by items, anything else by blocks */
function itemDiff(before: Block[], after: Block[], words: Words): Block[] {
  const [l, ...lRest] = before;
  const [r, ...rRest] = after;
  if (!l || !r || l.t !== 'p' || r.t !== 'p') return diffBlocks(before, after, words);
  const first: Block = sig(l) === sig(r) ? r : (count(words, plain(l.c), plain(r.c)), { t: 'p', c: inlineDiff(l.c, r.c) });
  const lList = lRest.length === 1 && lRest[0]!.t === 'list' ? lRest[0] : null;
  const rList = rRest.length === 1 && rRest[0]!.t === 'list' ? rRest[0] : null;
  if (lList && rList) return [first, listDiff(lList, rList, words)];
  return [first, ...diffBlocks(lRest, rRest, words)];
}

// Words: token LCS over the inline runs, short shared stretches folded so a rewrite reads as one replace

type Wrap = { t: 'strong' } | { t: 'em' } | { t: 'link'; href: string };

interface Token {
  text: string;
  /** Inline code and line breaks are one token each */
  kind: 'text' | 'code' | 'br';
  wraps: Wrap[];
}

const tokenKey = (t: Token) => `${t.kind}\u0001${JSON.stringify(t.wraps)}\u0001${t.text}`;

function tokens(c: Inline[], wraps: Wrap[] = [], out: Token[] = []): Token[] {
  for (const i of c) {
    switch (i.t) {
      case 'text':
        for (const w of wordTokens(i.v)) out.push({ text: w, kind: 'text', wraps });
        break;
      case 'code':
        out.push({ text: i.v, kind: 'code', wraps });
        break;
      case 'br':
        out.push({ text: '\n', kind: 'br', wraps });
        break;
      case 'strong':
      case 'em':
        tokens(i.c, [...wraps, { t: i.t }], out);
        break;
      case 'link':
        tokens(i.c, [...wraps, { t: 'link', href: i.href }], out);
        break;
      case 'ins':
      case 'del':
        tokens(i.c, wraps, out);
        break;
    }
  }
  return out;
}

function wordTokens(text: string): string[] {
  return text === '' ? [] : text.split(/(\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+)/u).filter((t) => t !== '');
}

interface Segment {
  kind: 'equal' | 'remove' | 'add';
  tokens: Token[];
}

/** Inline runs of the after version with removed and added runs marked */
export function inlineDiff(before: Inline[], after: Inline[]): Inline[] {
  const left = tokens(before);
  const right = tokens(after);
  const raw: Segment[] = [];
  for (const op of lcs(left, right, (a, b) => tokenKey(a) === tokenKey(b))) {
    const kind = op.kind;
    const token = op.kind === 'equal' ? op.after : op.flat;
    const last = raw[raw.length - 1];
    if (last && last.kind === kind) last.tokens.push(token);
    else raw.push({ kind, tokens: [token] });
  }
  const out: Inline[] = [];
  for (const s of collapseWeakEquals(raw)) {
    const runs = build(s.tokens);
    if (s.kind === 'equal') out.push(...runs);
    else out.push({ t: s.kind === 'remove' ? 'del' : 'ins', c: runs });
  }
  return merge(out);
}

function isStrongEqual(tokens: Token[]): boolean {
  const text = tokens.map((t) => t.text).join('');
  if ((text.match(/[\p{L}\p{N}_]+/gu) ?? []).length >= 3) return true;
  return text.replace(/\s+/g, '').length >= 20;
}

function collapseWeakEquals(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  let run: Segment[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const del = run.filter((s) => s.kind !== 'add').flatMap((s) => s.tokens);
    const ins = run.filter((s) => s.kind !== 'remove').flatMap((s) => s.tokens);
    if (del.length) out.push({ kind: 'remove', tokens: del });
    if (ins.length) out.push({ kind: 'add', tokens: ins });
    run = [];
  };
  segments.forEach((s, i) => {
    if (s.kind === 'equal' && (i === 0 || i === segments.length - 1 || isStrongEqual(s.tokens))) {
      flush();
      out.push(s);
    } else {
      run.push(s);
    }
  });
  flush();
  return out;
}

/** Tokens back to inline runs, each wrapped in its formatting */
function build(tokens: Token[]): Inline[] {
  return merge(
    tokens.map((tok) => {
      let node: Inline = tok.kind === 'code' ? { t: 'code', v: tok.text } : tok.kind === 'br' ? { t: 'br' } : { t: 'text', v: tok.text };
      for (let i = tok.wraps.length - 1; i >= 0; i--) {
        const w = tok.wraps[i]!;
        node = w.t === 'link' ? { t: 'link', href: w.href, c: [node] } : { t: w.t, c: [node] };
      }
      return node;
    }),
  );
}

/** Neighbouring runs of the same kind joined */
function merge(nodes: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (last && last.t === 'text' && n.t === 'text') last.v += n.v;
    else if (last && 'c' in last && 'c' in n && last.t === n.t && (last.t !== 'link' || (n.t === 'link' && last.href === n.href))) {
      last.c = merge([...last.c, ...n.c]);
    } else out.push(n.t === 'text' ? { ...n } : 'c' in n ? ({ ...n, c: [...n.c] } as Inline) : n);
  }
  return out;
}

// Lines: line LCS, then a paired removed and added line is marked inside

function wordMarks(before: string, after: string): Span[] {
  const raw: Segment[] = [];
  const tok = (s: string): Token[] => wordTokens(s).map((text) => ({ text, kind: 'text', wraps: [] }));
  for (const op of lcs(tok(before), tok(after), (a, b) => a.text === b.text)) {
    const token = op.kind === 'equal' ? op.after : op.flat;
    const last = raw[raw.length - 1];
    if (last && last.kind === op.kind) last.tokens.push(token);
    else raw.push({ kind: op.kind, tokens: [token] });
  }
  return collapseWeakEquals(raw).map((s) => ({
    k: s.kind === 'equal' ? 'eq' : s.kind === 'remove' ? 'del' : 'ins',
    v: s.tokens.map((t) => t.text).join(''),
  }));
}

/** Shared prefix and suffix kept, the middle removed and added: how a diagram's source lines read */
function charMarks(before: string, after: string): Span[] {
  let start = 0;
  const min = Math.min(before.length, after.length);
  while (start < min && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const spans: Span[] = [
    { k: 'eq', v: before.slice(0, start) },
    { k: 'del', v: before.slice(start, before.length - end) },
    { k: 'ins', v: after.slice(start, after.length - end) },
    { k: 'eq', v: before.slice(before.length - end) },
  ];
  return spans.filter((s) => s.v !== '');
}

function lineDiff(before: string, after: string, inLine: (b: string, a: string) => Span[]): Span[] {
  const out: Span[] = [];
  const push = (...spans: Span[]) => {
    for (const s of spans) {
      const last = out[out.length - 1];
      if (last && last.k === s.k) last.v += s.v;
      else out.push({ ...s });
    }
  };
  let first = true;
  const line = (spans: Span[]) => {
    if (!first) push({ k: 'eq', v: '\n' });
    first = false;
    push(...spans);
  };
  const removed: string[] = [];
  const added: string[] = [];
  const flush = () => {
    let ri = 0;
    let ai = 0;
    for (; ri < removed.length && ai < added.length; ri++, ai++) line(inLine(removed[ri]!, added[ai]!));
    for (; ri < removed.length; ri++) line([{ k: 'del', v: removed[ri]! }]);
    for (; ai < added.length; ai++) line([{ k: 'ins', v: added[ai]! }]);
    removed.length = 0;
    added.length = 0;
  };
  for (const op of lcs(before.split('\n'), after.split('\n'), (a, b) => a.trimStart() === b.trimStart())) {
    if (op.kind === 'equal') {
      flush();
      line([{ k: 'eq', v: op.after }]);
    } else if (op.kind === 'remove') {
      if (added.length > 0) flush();
      removed.push(op.flat);
    } else {
      added.push(op.flat);
    }
  }
  flush();
  return out.filter((s) => s.v !== '');
}

// Shared

type LcsOp<T> = { kind: 'equal'; before: T; after: T } | { kind: 'remove'; flat: T } | { kind: 'add'; flat: T };

function lcs<T>(before: T[], after: T[], same: (a: T, b: T) => boolean): LcsOp<T>[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = same(before[i]!, after[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: LcsOp<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(before[i]!, after[j]!)) {
      ops.push({ kind: 'equal', before: before[i]!, after: after[j]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: 'remove', flat: before[i++]! });
    } else {
      ops.push({ kind: 'add', flat: after[j++]! });
    }
  }
  while (i < n) ops.push({ kind: 'remove', flat: before[i++]! });
  while (j < m) ops.push({ kind: 'add', flat: after[j++]! });
  return ops;
}

const sigs = new WeakMap<object, string>();

/** Content identity: rendering (SVG, picking boxes) and whitespace do not count */
function sig(value: unknown): string {
  const cached = typeof value === 'object' && value !== null ? sigs.get(value) : undefined;
  if (cached !== undefined) return cached;
  const s = collapse(JSON.stringify(value, (k, v) => (k === 'svg' || k === 'elements' ? undefined : v)) ?? '');
  if (typeof value === 'object' && value !== null) sigs.set(value, s);
  return s;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function plain(c: Inline[]): string {
  return c.map((i) => (i.t === 'br' ? '\n' : 'v' in i ? i.v : 'c' in i ? plain(i.c) : '')).join('');
}

/** The words a block reads as */
function text(b: Block | null): string {
  if (!b) return '';
  switch (b.t) {
    case 'p':
    case 'h':
      return plain(b.c);
    case 'list':
      return b.items.map((item) => item.map(text).join('\n')).join('\n');
    case 'table':
      return [b.head, ...b.rows].map((row) => row.map(plain).join(' | ')).join('\n');
    case 'code':
      return b.v;
    case 'diagram':
      return b.source;
    case 'quote':
    case 'ins':
    case 'del':
      return b.c.map(text).join('\n');
    case 'hr':
      return '';
  }
}

const wordsOf = (s: string) => s.match(/[\p{L}\p{N}_]+/gu) ?? [];

/** Word LCS: words removed and added between two texts */
function count(words: Words, before: string, after: string): void {
  const l = wordsOf(before);
  const r = wordsOf(after);
  const common = lcs(l, r, (a, b) => a === b).filter((o) => o.kind === 'equal').length;
  words.removed += l.length - common;
  words.added += r.length - common;
}
