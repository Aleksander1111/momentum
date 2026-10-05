import type { Block, CardDiff, Inline } from '@momentum/contract';

/**
 * The plain text of a card, and of either side of a card diff: what the user reads before and after a change, whatever
 * words a run chose. Whitespace is collapsed so the same words compare equal however they are laid out.
 */

type Side = 'before' | 'after';

function inline(c: Inline[], side: Side | null): string {
  return c
    .map((i) => {
      switch (i.t) {
        case 'text':
        case 'code':
          return i.v;
        case 'br':
          return ' ';
        case 'ins':
          return side === 'before' ? '' : inline(i.c, side);
        case 'del':
          return side === 'after' ? '' : inline(i.c, side);
        default:
          return inline(i.c, side);
      }
    })
    .join('');
}

/** Whether a marked list item or table row is on this side */
const kept = (mark: string | null | undefined, side: Side | null) => !mark || side === null || (mark === 'ins' ? side === 'after' : side === 'before');

function blocks(b: Block[], side: Side | null): string {
  return b
    .map((x) => {
      switch (x.t) {
        case 'p':
        case 'h':
          return inline(x.c, side);
        case 'list':
          return x.items.filter((_, i) => kept(x.marks?.[i], side)).map((item) => blocks(item, side)).join(' ');
        case 'table':
          return [x.head.map((c) => inline(c, side)).join(' '), ...x.rows.filter((_, i) => kept(x.marks?.[i], side)).map((r) => r.map((c) => inline(c, side)).join(' '))].join(' ');
        case 'code':
          return x.diff ? x.diff.filter((s) => s.k === 'eq' || (side === 'after' ? s.k === 'ins' : s.k === 'del')).map((s) => s.v).join('') : x.v;
        case 'diagram':
          return side === 'before' && x.before ? x.before.source : x.source;
        case 'quote':
          return blocks(x.c, side);
        case 'ins':
          return side === 'before' ? '' : blocks(x.c, side);
        case 'del':
          return side === 'after' ? '' : blocks(x.c, side);
        default:
          return '';
      }
    })
    .join(' ');
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The text of a card as it reads */
export const plain = (card: Block[]) => squash(blocks(card, null));

/** The text the diff shows before the change, and after it */
export function sides(diff: CardDiff): { before: string; after: string } {
  return { before: squash(blocks(diff.card, 'before')), after: squash(blocks(diff.card, 'after')) };
}
