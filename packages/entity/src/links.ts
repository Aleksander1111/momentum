/**
 * Links between entities inside a card's text. A card may link an entity where naming it helps the reading, as a
 * markdown link whose target is the entity path: [the consistency guard](Architecture/Component/consistency-guard).
 * The path may also be written as its file, knowledge-graph/<path>.md, or with the entity: scheme.
 */

import { entityLinkTarget } from '@momentum/contract';

export { entityLinkTarget };

/** Markdown links outside code: [text](target "title") */
const LINK = /\[((?:[^\][]|\[[^\]]*\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[ \t]*$/gm;
const CODE_SPAN = /`[^`\n]*`/g;

/** The entity paths a card links to, each once, in the order they first appear */
export function entityLinks(body: string): string[] {
  const text = body.replace(FENCE, '').replace(CODE_SPAN, '');
  const out = new Set<string>();
  for (const m of text.matchAll(LINK)) {
    const target = entityLinkTarget(m[2] ?? '');
    if (target) out.add(target);
  }
  return [...out];
}
