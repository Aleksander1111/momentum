import type { DiagramElement } from '@momentum/contract';

/**
 * Pickable shapes of a PlantUML SVG, ported from the stock-fly-8 knowledge base. PlantUML groups entities, packages,
 * arrows, participants, messages, legends and captions; notes, participant boxes and frames are drawn as bare shapes and
 * are grouped here as `g.decoration`. Every shape group is stamped `data-pick="<n>"`, n indexing the elements: the web
 * highlights by it, mobile overlays the boxes. A participant (head, tail and lifeline) is one element.
 */
export function pickable(svg: string): { svg: string; elements: DiagramElement[] } {
  if (!svg) return { svg, elements: [] };
  let root: Node;
  try {
    root = parse(svg);
  } catch {
    return { svg, elements: [] };
  }
  const svgNode = root.children.find((c): c is El => c.type === 'el' && c.tag === 'svg');
  if (!svgNode) return { svg, elements: [] };
  const drawing = svgNode.children.find((c): c is El => c.type === 'el' && c.tag === 'g');
  if (drawing && svgNode.attrs['data-diagram-type'] !== 'SALT') groupDecorations(drawing);

  const vb = (svgNode.attrs.viewBox ?? '').split(/[\s,]+/).map(Number);
  const [ox, oy] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0];
  const shapes = all(svgNode).filter((e) => e.tag === 'g' && (e.attrs.class ?? '').split(/\s+/).some((c) => SHAPES.has(c)));
  const byId = new Map(all(svgNode).filter((e) => e.attrs.id).map((e) => [e.attrs.id!, e]));
  const byUid = new Map(all(svgNode).filter((e) => e.attrs['data-entity-uid']).map((e) => [e.attrs['data-entity-uid']!, e]));

  const elements: DiagramElement[] = [];
  const index = new Map<string, number>();
  for (const shape of shapes) {
    const uid = shape.attrs['data-entity-uid'];
    const name = nameOf(shape, byId, byUid);
    const b = bounds(shape);
    const known = uid !== undefined ? index.get(uid) : undefined;
    if (known !== undefined) {
      const e = elements[known]!;
      if (name && !e.name.split(' ').includes(name)) e.name = e.name ? `${e.name} ${name}` : name;
      if (b) e.box = boxOf(union(fromBox(e.box, ox!, oy!), b), ox!, oy!);
      stamp(shape, known);
      continue;
    }
    if (!name || !b) continue;
    const n = elements.length;
    elements.push({ id: shape.attrs.id ?? uid ?? `shape-${n}`, name, box: boxOf(b, ox!, oy!) });
    if (uid !== undefined) index.set(uid, n);
    stamp(shape, n);
  }
  return { svg: serialize(root), elements };
}

const SHAPES = new Set(['entity', 'cluster', 'link', 'message', 'participant', 'participant-lifeline', 'decoration', 'legend', 'caption']);
const SHAPE_TAGS = new Set(['rect', 'path', 'polygon', 'line', 'ellipse', 'circle', 'image', 'polyline']);
/** `a` carries the text of a link inside a note */
const CONTENT_TAGS = new Set(['text', 'a']);

// A small XML tree: PlantUML writes well-formed SVG, kept verbatim except for the groups and stamps added here

type Node = { type: 'root'; children: Child[] };
type El = { type: 'el'; tag: string; attrs: Record<string, string>; open: string; selfClosing: boolean; children: Child[] };
type Raw = { type: 'raw'; text: string };
type Child = El | Raw;

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|[^<]+/g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;

function parse(xml: string): Node {
  const root: Node = { type: 'root', children: [] };
  const stack: (Node | El)[] = [root];
  for (const m of xml.matchAll(TOKEN)) {
    const top = stack[stack.length - 1]!;
    if (m[1]) {
      if (stack.length === 1 || (top as El).tag !== m[1]) throw new Error(`Unbalanced </${m[1]}>`);
      stack.pop();
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of (m[3] ?? '').matchAll(ATTR)) attrs[a[1]!] = decode(a[2] ?? a[3] ?? '');
      const el: El = { type: 'el', tag: m[2], attrs, open: m[0], selfClosing: m[4] === '/', children: [] };
      top.children.push(el);
      if (!el.selfClosing) stack.push(el);
    } else {
      top.children.push({ type: 'raw', text: m[0] });
    }
  }
  if (stack.length !== 1) throw new Error('Unclosed element');
  return root;
}

function serialize(n: Node | Child): string {
  if (n.type === 'raw') return n.text;
  if (n.type === 'root') return n.children.map(serialize).join('');
  if (n.selfClosing) return n.open;
  return `${n.open}${n.children.map(serialize).join('')}</${n.tag}>`;
}

function stamp(el: El, n: number): void {
  el.attrs['data-pick'] = String(n);
  el.open = el.open.replace(/\s*(\/?)>$/, ` data-pick="${n}"$1>`);
}

function all(el: El, out: El[] = []): El[] {
  for (const c of el.children) {
    if (c.type !== 'el') continue;
    out.push(c);
    all(c, out);
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function textOf(el: El): string {
  return el.children.map((c) => (c.type === 'raw' ? (c.text.startsWith('<') ? '' : decode(c.text)) : textOf(c))).join('');
}

// Names: what a picked shape reads as in the chat context

function nameOf(shape: El, byId: Map<string, El>, byUid: Map<string, El>): string {
  const drawn = all(shape)
    .filter((e) => e.tag === 'text')
    .map(textOf)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (drawn !== '') return drawn;
  // An unlabelled arrow has no text of its own, so it reads as the two shapes it joins
  const from = shape.attrs['data-entity-1'];
  const to = shape.attrs['data-entity-2'];
  if (from === undefined || to === undefined) return '';
  const end = (uid: string) => {
    const q = (byId.get(uid) ?? byUid.get(uid))?.attrs['data-qualified-name'];
    return q ? q.slice(q.lastIndexOf('.') + 1) : null;
  };
  const a = end(from);
  const b = end(to);
  return a && b ? `${a} → ${b}` : '';
}

// Bounds, in SVG user units

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const num = (v: string | undefined) => (v === undefined ? NaN : parseFloat(v));

function fromPoints(xs: number[], ys: number[]): Bounds | null {
  const fx = xs.filter(Number.isFinite);
  const fy = ys.filter(Number.isFinite);
  if (!fx.length || !fy.length) return null;
  return { left: Math.min(...fx), top: Math.min(...fy), right: Math.max(...fx), bottom: Math.max(...fy) };
}

function pathPoints(d: string): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  let x = 0;
  let y = 0;
  for (const m of d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)) {
    const cmd = m[1]!;
    const n = (m[2]!.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    const at = (px: number, py: number) => {
      xs.push(px);
      ys.push(py);
    };
    switch (cmd.toUpperCase()) {
      case 'H':
        for (const v of n) at((x = rel ? x + v : v), y);
        break;
      case 'V':
        for (const v of n) at(x, (y = rel ? y + v : v));
        break;
      case 'A':
        for (let i = 0; i + 6 < n.length; i += 7) {
          x = rel ? x + n[i + 5]! : n[i + 5]!;
          y = rel ? y + n[i + 6]! : n[i + 6]!;
          at(x, y);
        }
        break;
      case 'Z':
        break;
      default: {
        const bx = x;
        const by = y;
        for (let i = 0; i + 1 < n.length; i += 2) {
          const px = rel ? bx + n[i]! : n[i]!;
          const py = rel ? by + n[i + 1]! : n[i + 1]!;
          at(px, py);
          x = px;
          y = py;
        }
      }
    }
  }
  return { xs, ys };
}

function ownBounds(el: El): Bounds | null {
  const a = el.attrs;
  switch (el.tag) {
    case 'rect':
    case 'image': {
      const x = num(a.x) || 0;
      const y = num(a.y) || 0;
      return fromPoints([x, x + (num(a.width) || 0)], [y, y + (num(a.height) || 0)]);
    }
    case 'ellipse':
    case 'circle': {
      const rx = num(a.rx ?? a.r);
      const ry = num(a.ry ?? a.r);
      return fromPoints([num(a.cx) - rx, num(a.cx) + rx], [num(a.cy) - ry, num(a.cy) + ry]);
    }
    case 'line':
      return fromPoints([num(a.x1), num(a.x2)], [num(a.y1), num(a.y2)]);
    case 'polygon':
    case 'polyline': {
      const n = (a.points ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
      return fromPoints(n.filter((_, i) => i % 2 === 0), n.filter((_, i) => i % 2 === 1));
    }
    case 'path': {
      const p = pathPoints(a.d ?? '');
      return fromPoints(p.xs, p.ys);
    }
    case 'text': {
      const size = num(a['font-size']) || 12;
      const x = num(a.x);
      const y = num(a.y);
      const w = num(a.textLength) || textOf(el).length * size * 0.55;
      return fromPoints([x, x + w], [y - size, y + size * 0.25]);
    }
    default:
      return null;
  }
}

function bounds(el: El): Bounds | null {
  let b = ownBounds(el);
  for (const c of el.children) {
    if (c.type !== 'el') continue;
    const cb = bounds(c);
    if (cb) b = b ? union(b, cb) : cb;
  }
  return b;
}

function union(a: Bounds, b: Bounds): Bounds {
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

function adjoin(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

function samePlace(a: Bounds, b: Bounds): boolean {
  return Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.right - b.right) < 1 && Math.abs(a.bottom - b.bottom) < 1;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function boxOf(b: Bounds, ox: number, oy: number): [number, number, number, number] {
  return [r2(b.left - ox), r2(b.top - oy), r2(b.right - b.left), r2(b.bottom - b.top)];
}

function fromBox(box: [number, number, number, number], ox: number, oy: number): Bounds {
  return { left: box[0] + ox, top: box[1] + oy, right: box[0] + ox + box[2], bottom: box[1] + oy + box[3] };
}

// Decorations

interface Decoration {
  nodes: El[];
  bounds: Bounds;
  /** Shapes only: label text overhangs a frame by a pixel or two, which no place test should see */
  shapeBounds: Bounds;
}

/**
 * PlantUML draws a decoration as its shapes and then its text, so a shape that follows text opens the next one, and a
 * shape that touches nothing in the run belongs to something else. A frame's fill and its outline sit at the same place
 * yet far apart in the markup, so runs covering the same place join, where the fill was drawn.
 */
function groupDecorations(drawing: El): void {
  const runs: Decoration[] = [];
  let current: Decoration | null = null;
  let afterContent = false;
  for (const child of drawing.children) {
    if (child.type !== 'el') continue;
    const isShape = SHAPE_TAGS.has(child.tag);
    if (!isShape && !CONTENT_TAGS.has(child.tag)) {
      current = null;
      afterContent = false;
      continue;
    }
    const b = bounds(child);
    if (!b) continue;
    if (current !== null && adjoin(current.bounds, b) && !(isShape && afterContent)) {
      current.nodes.push(child);
      current.bounds = union(current.bounds, b);
      if (isShape) current.shapeBounds = union(current.shapeBounds, b);
    } else {
      current = { nodes: [child], bounds: b, shapeBounds: b };
      runs.push(current);
    }
    afterContent = !isShape;
  }
  const joined: Decoration[] = [];
  for (const run of runs) {
    const twin = joined.find((c) => samePlace(c.shapeBounds, run.shapeBounds));
    if (twin) twin.nodes.push(...run.nodes);
    else joined.push(run);
  }
  if (joined.length === 0) return;
  const owner = new Map<El, Decoration>();
  for (const d of joined) for (const n of d.nodes) owner.set(n, d);
  const children: Child[] = [];
  for (const child of drawing.children) {
    const d = child.type === 'el' ? owner.get(child) : undefined;
    if (!d) {
      children.push(child);
      continue;
    }
    if (d.nodes[0] !== child) continue;
    children.push({ type: 'el', tag: 'g', attrs: { class: 'decoration' }, open: '<g class="decoration">', selfClosing: false, children: d.nodes });
  }
  drawing.children = children;
}
