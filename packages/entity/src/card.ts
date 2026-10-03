import type { Block, Card, DiagramElement, Inline } from '@momentum/contract';
import type { PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { pickable } from './diagram-elements.ts';

export type DiagramRenderer = (sources: string[]) => Promise<string[]>;

const processor = unified().use(remarkParse).use(remarkGfm);

function inline(nodes: PhrasingContent[]): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        out.push({ t: 'text', v: n.value });
        break;
      case 'strong':
        out.push({ t: 'strong', c: inline(n.children) });
        break;
      case 'emphasis':
        out.push({ t: 'em', c: inline(n.children) });
        break;
      case 'inlineCode':
        out.push({ t: 'code', v: n.value });
        break;
      case 'link':
        out.push({ t: 'link', href: n.url, c: inline(n.children) });
        break;
      case 'break':
        out.push({ t: 'br' });
        break;
      default:
        if ('children' in n) out.push(...inline(n.children as PhrasingContent[]));
        else if ('value' in n) out.push({ t: 'text', v: String(n.value) });
    }
  }
  return out;
}

function block(node: RootContent, diagrams: Block[]): Block | null {
  switch (node.type) {
    case 'paragraph':
      return { t: 'p', c: inline(node.children) };
    case 'heading':
      return { t: 'h', depth: node.depth, c: inline(node.children) };
    case 'list':
      return {
        t: 'list',
        ordered: node.ordered ?? false,
        items: node.children.map((item) => blocks(item.children, diagrams)),
      };
    case 'table': {
      const [head, ...rows] = node.children;
      return {
        t: 'table',
        head: head ? head.children.map((cell) => inline(cell.children)) : [],
        rows: rows.map((row) => row.children.map((cell) => inline(cell.children))),
      };
    }
    case 'code': {
      if (node.lang !== 'plantuml') return { t: 'code', lang: node.lang ?? null, v: node.value };
      const diagram: Block = { t: 'diagram', svg: '', source: node.value };
      diagrams.push(diagram);
      return diagram;
    }
    case 'blockquote':
      return { t: 'quote', c: blocks(node.children, diagrams) };
    case 'thematicBreak':
      return { t: 'hr' };
    case 'html':
      return { t: 'p', c: [{ t: 'text', v: node.value }] };
    default:
      return null;
  }
}

function blocks(nodes: RootContent[], diagrams: Block[]): Block[] {
  return nodes.map((c) => block(c, diagrams)).filter((b): b is Block => b !== null);
}

/** Card from the markdown AST; plantuml code blocks become diagrams rendered to SVG */
export async function toCard(body: string, render?: DiagramRenderer): Promise<Card> {
  const tree = processor.parse(body) as Root;
  const card = blocks(tree.children, []);
  if (render) await renderDiagrams(card, render);
  return card;
}

type Drawn = { svg: string; source: string; elements?: DiagramElement[] };

/** Renders every diagram of a card, a diff card's before versions included, that has no SVG yet, with its pickable shapes */
export async function renderDiagrams(card: Card, render: DiagramRenderer): Promise<void> {
  const pending: Drawn[] = [];
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'diagram') {
        if (!b.svg) pending.push(b);
        if (b.before && !b.before.svg) pending.push(b.before);
      } else if (b.t === 'quote' || b.t === 'ins' || b.t === 'del') walk(b.c);
      else if (b.t === 'list') b.items.forEach(walk);
    }
  };
  walk(card);
  if (pending.length === 0) return;
  const svgs = await render(pending.map((d) => d.source));
  pending.forEach((d, i) => {
    const { svg, elements } = pickable(svgs[i] ?? '');
    d.svg = svg;
    d.elements = elements;
  });
}
