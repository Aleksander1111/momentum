// Mechanics slides: how everything works together, as illustrations.
// Each slide is an SVG drawn here, rendered by Edge (playwright-core) and placed under the
// deck's title bar. Labels are noun phrases; the picture carries the mechanism.
const React = require('react');
const RDS = require('react-dom/server');
const fa = require('react-icons/fa6');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const W = 1920, H = 950;
const C = {
  ink: '#2F3E46', muted: '#52606A', accent: '#B85042', ok: '#3F6B52', ochre: '#7C6224', red: '#A0402F',
  line: '#D5D9D3', paper: '#EEF1EC', bar: '#E3E7E1', white: '#FFFFFF',
};
const LAYER = {
  prod: { wash: '#DCE7DF', strong: '#3F6B52' },
  kn: { wash: '#EFE8D2', strong: '#7C6224' },
  att: { wash: '#F4DCD6', strong: '#A0402F' },
  ink: { wash: '#E4E8EA', strong: '#2F3E46' },
};
// The app's own state glyphs (apps/app/src/ui/StateBadge.tsx), on a 24 grid
const STATE = {
  unverified: { d: 'M8 8a3.5 3 0 0 1 3.5-3h1a3.5 3 0 0 1 3.5 3 3 3 0 0 1-2 3 3 4 0 0 0-2 4M12 19v.01', color: '#8A6D2B', wash: '#F3EBD8' },
  verified: { d: 'M5 12l5 5L20 7', color: '#3F6B52', wash: '#DCE7DF' },
  synced: { d: 'M9 15l6-6M11 6l.46-.54a5 5 0 0 1 7.08 7.08l-.54.46M13 18l-.4.53a5.07 5.07 0 0 1-7.12 0 4.97 4.97 0 0 1 0-7.07l.52-.46', color: '#3F6B52', wash: '#DCE7DF' },
  entity_ahead: { d: 'M12 20V10M12 20l4-4M12 20l-4-4M4 4h16', color: '#7C6224', wash: '#EFE8D2' },
  artifact_ahead: { d: 'M12 4v10M12 4l4 4M12 4L8 8M4 20h16', color: '#A0402F', wash: '#F4DCD6' },
  updating: { d: 'M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4', color: '#52606A', wash: '#E4E8EA' },
};
const HEAD = 'Cambria, Georgia, serif', BODY = 'Calibri, Segoe UI, sans-serif';

// ---------------------------------------------------------------- drawing helpers
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Math.round(v * 10) / 10;

function text(x, y, s, o = {}) {
  const size = o.size ?? 20;
  const a = [`x="${n(x)}"`, `y="${n(y)}"`, `font-family="${o.head ? HEAD : BODY}"`, `font-size="${size}"`, `fill="${o.fill ?? C.ink}"`];
  if (o.bold) a.push('font-weight="700"');
  if (o.italic) a.push('font-style="italic"');
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.spacing) a.push(`letter-spacing="${o.spacing}"`);
  if (o.rot) a.push(`transform="rotate(${o.rot} ${n(x)} ${n(y)})"`);
  return `<text ${a.join(' ')}>${esc(s)}</text>`;
}
/** A title and a muted line beneath it */
const caption = (x, y, title, sub, o = {}) =>
  text(x, y, title, { head: true, bold: true, size: o.size ?? 26, anchor: o.anchor, fill: o.fill ?? C.ink }) +
  (sub ? text(x, y + (o.gap ?? 28), sub, { size: o.subSize ?? 19, fill: C.muted, anchor: o.anchor, italic: o.italic }) : '');

function icon(name, x, y, size, color) {
  if (!fa[name]) throw new Error(`No icon ${name}`);
  const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { size, color }));
  return svg.replace('<svg ', `<svg x="${n(x)}" y="${n(y)}" `);
}
const iconAt = (name, cx, cy, size, color) => icon(name, cx - size / 2, cy - size / 2, size, color);

function attrs(o) {
  const a = [`fill="${o.fill ?? 'none'}"`, `stroke="${o.stroke ?? 'none'}"`, `stroke-width="${o.sw ?? 2}"`];
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.shadow) a.push('filter="url(#sh)"');
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.head) a.push(`marker-end="url(#ah-${o.head})"`);
  if (o.tail) a.push(`marker-start="url(#ah-${o.tail})"`);
  a.push('stroke-linecap="round"', 'stroke-linejoin="round"');
  return a.join(' ');
}
const rect = (x, y, w, h, o = {}) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${o.r ?? 0}" ${attrs(o)}/>`;
const circle = (cx, cy, r, o = {}) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs(o)}/>`;
const path = (d, o = {}) => `<path d="${d}" ${attrs(o)}/>`;
const line = (x1, y1, x2, y2, o = {}) => path(`M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}`, o);
const pt = (p) => `${n(p[0])} ${n(p[1])}`;

/** A word on a line: white pill with the text centred */
function pill(cx, cy, s, o = {}) {
  const size = o.size ?? 17, w = s.length * size * 0.5 + 26, h = size + 14;
  return rect(cx - w / 2, cy - h / 2, w, h, { r: h / 2, fill: o.fill ?? C.white, stroke: o.stroke ?? C.line, sw: 1.5 }) +
    text(cx, cy + size * 0.35, s, { size, anchor: 'middle', fill: o.color ?? C.ink, italic: o.italic ?? true, bold: o.bold });
}
function stateGlyph(state, cx, cy, size, color) {
  const s = STATE[state], k = size / 24;
  return `<g transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${n(k * 1000) / 1000})"><path d="${s.d}" fill="none" stroke="${color ?? s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
function medallion(cx, cy, r, layer, ic, o = {}) {
  return circle(cx, cy, r, { fill: C.white, shadow: true }) +
    circle(cx, cy, r - 7, { fill: layer.wash, stroke: layer.strong, sw: 3 }) +
    iconAt(ic, cx, cy, r * (o.k ?? 0.82), o.color ?? C.ink);
}
const badge = (cx, cy, v) => circle(cx, cy, 17, { fill: C.red, stroke: C.white, sw: 3 }) + text(cx, cy + 6.5, v, { size: 18, bold: true, fill: C.white, anchor: 'middle' });

/** A card as the app shows it: breadcrumb, serif title, the body as skeleton lines */
function miniCard(x, y, w, h, o = {}) {
  const pad = o.pad ?? 18;
  let g = rect(x, y, w, h, { r: 16, fill: C.white, stroke: o.stroke ?? C.line, sw: o.sw ?? 1.5, shadow: true });
  let yy = y + pad + 10;
  if (o.crumb) {
    g += text(x + pad, yy, o.crumb, { size: o.crumbSize ?? 12, bold: true, fill: C.accent, spacing: 1.5 });
    yy += 28;
  }
  for (const t of [].concat(o.title ?? [])) {
    g += text(x + pad, yy, t, { head: true, bold: true, size: o.titleSize ?? 20 });
    yy += (o.titleSize ?? 20) * 1.25;
  }
  if (o.title) yy += 4;
  for (const b of o.bars ?? [0.92, 0.78, 0.86, 0.55, 0.8, 0.66]) {
    if (yy + 8 > y + h - pad) break;
    g += rect(x + pad, yy, (w - 2 * pad) * b, 8, { r: 4, fill: C.bar });
    yy += 18;
  }
  (o.glyphs ?? []).forEach((st, i, all) => (g += stateGlyph(st, x + w - pad - 11 - (all.length - 1 - i) * 30, y + pad + 4, 22)));
  if (o.flag) g += icon('FaFlag', x + w - pad - 22, y + pad - 6, 22, C.red);
  if (o.badge) g += badge(x + w - 4, y + 4, o.badge);
  return o.rot ? `<g transform="rotate(${o.rot} ${n(x + w / 2)} ${n(y + h / 2)})">${g}</g>` : g;
}

/** A document with a folded corner and an icon */
function doc(x, y, w, h, o = {}) {
  const f = w * 0.24, s = o.stroke ?? C.ink;
  let g = path(`M${x} ${y + 10}q0 -10 10 -10H${x + w - f}L${x + w} ${y + f}V${y + h - 10}q0 10 -10 10H${x + 10}q-10 0 -10 -10Z`, { fill: C.white, stroke: s, sw: 2.5, shadow: true });
  g += path(`M${x + w - f} ${y}V${y + f}H${x + w}`, { fill: C.paper, stroke: s, sw: 2.5 });
  const is = w * 0.42;
  g += iconAt(o.icon ?? 'FaFileLines', x + w / 2, y + h * 0.45, is, o.iconColor ?? s);
  if (o.label) g += text(x + w / 2, y + h - 14, o.label, { size: o.labelSize ?? 15, anchor: 'middle', fill: C.muted });
  return o.rot ? `<g transform="rotate(${o.rot} ${n(x + w / 2)} ${n(y + h / 2)})">${g}</g>` : g;
}

/** A run: rounded pod with an icon and a name */
function pod(x, y, w, h, label, ic, layer, o = {}) {
  return rect(x, y, w, h, { r: h / 2, fill: o.ghost ? C.white : layer.wash, stroke: layer.strong, sw: 2.5, dash: o.ghost ? '8 7' : undefined, shadow: !o.ghost }) +
    iconAt(ic, x + h / 2 + 4, y + h / 2, h * 0.46, layer.strong) +
    text(x + h + 8, y + h / 2 + 7, label, { size: o.size ?? 20, bold: true, fill: o.ghost ? C.muted : C.ink });
}

/** A small knowledge graph: nodes and references, optionally with one contradiction */
const GRAPH = {
  nodes: [[-90, -40], [-25, -95], [60, -70], [100, 5], [35, 45], [-55, 55], [-5, -20], [120, -90], [-120, 25]],
  edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4], [2, 7], [0, 8]],
  colors: ['prod', 'kn', 'att', 'prod', 'kn', 'att', 'ink', 'kn', 'prod'],
};
function zigzag(p, q, amp = 9, steps = 7) {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  let d = `M${pt(p)}`;
  for (let i = 1; i < steps; i++) {
    const t = i / steps, s = i % 2 ? amp : -amp;
    d += ` L${pt([p[0] + dx * t - uy * s, p[1] + dy * t + ux * s])}`;
  }
  return d + ` L${pt(q)}`;
}
function graph(cx, cy, k = 1, o = {}) {
  const P = GRAPH.nodes.map(([x, y]) => [cx + x * k, cy + y * k]);
  let g = '';
  for (const [a, b] of GRAPH.edges) {
    if (o.contradiction && ((a === 1 && b === 2) || (a === 2 && b === 1))) continue;
    g += line(P[a][0], P[a][1], P[b][0], P[b][1], { stroke: '#A9B4AE', sw: 3 * Math.min(1, k) + 0.5 });
  }
  if (o.contradiction) g += path(zigzag(P[1], P[2], 8 * k, 7), { stroke: C.red, sw: 4 });
  P.forEach(([x, y], i) => (g += circle(x, y, 14 * k, { fill: C.white, stroke: LAYER[GRAPH.colors[i]].strong, sw: 4 * Math.min(1, k) + 0.5 })));
  if (o.contradiction) {
    for (const i of [1, 2]) g += circle(P[i][0], P[i][1], 14 * k, { fill: LAYER.att.wash, stroke: C.red, sw: 4 });
  }
  return g;
}

/** A curved arrow between two circles, labelled at its middle */
function curve(a, b, ra, rb, bend, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const p0 = [a[0] + ux * (ra + 8), a[1] + uy * (ra + 8)], p1 = [b[0] - ux * (rb + 12), b[1] - uy * (rb + 12)];
  const m = [(p0[0] + p1[0]) / 2 - uy * bend, (p0[1] + p1[1]) / 2 + ux * bend];
  let g = path(`M${pt(p0)} Q${pt(m)} ${pt(p1)}`, { stroke: o.stroke ?? C.ink, sw: o.sw ?? 4, head: o.head ?? 'ink', dash: o.dash });
  if (o.label) {
    const lp = [0.25 * p0[0] + 0.5 * m[0] + 0.25 * p1[0], 0.25 * p0[1] + 0.5 * m[1] + 0.25 * p1[1]];
    g += pill(lp[0] + (o.dx ?? 0), lp[1] + (o.dy ?? 0), o.label, { color: o.stroke ?? C.ink });
  }
  return g;
}

function defs() {
  const heads = { ink: C.ink, muted: C.muted, ok: C.ok, kn: C.ochre, att: C.red, accent: C.accent, prod: C.ok, line: '#A9B4AE' };
  return `<defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#1E293B" flood-opacity="0.16"/></filter>
    ${Object.entries(heads).map(([k, c]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('')}
  </defs>`;
}
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}<rect width="${W}" height="${H}" fill="#FFFFFF"/>${body}</svg>`;

// ---------------------------------------------------------------- 1. the loop
function loop() {
  // You on top, the consistency guard at the bottom, the shortcut between them straight down the middle
  const cx = 960, cy = 468, Rx = 480, Ry = 310, r = 60;
  const S = [
    ['You', 'FaUser', 'att', 'approve · send back · chat', 270],
    ['Triggers', 'FaClock', 'prod', 'schedule · event · on demand', 301],
    ['Runs', 'FaTerminal', 'prod', 'own checkout of the main line', 338],
    ['Work', 'FaFileCode', 'prod', 'entities and artifacts', 383],
    ['Summarization', 'FaWandMagicSparkles', 'prod', 'artifacts into cards', 419],
    ['Consistency guard', 'FaShieldHalved', 'kn', 'validated, then landed', 450],
    ['Main line', 'FaCodeCommit', 'kn', 'one branch, a commit per run', 504],
    ['Attention feed', 'FaLayerGroup', 'att', 'ranked, unverified first', 576],
  ];
  const rad = (d) => (d * Math.PI) / 180;
  const at = (deg, k = 0) => [cx + (Rx - k) * Math.cos(rad(deg)), cy + (Ry - k) * Math.sin(rad(deg))];
  let g = circle(cx, cy, 215, { fill: C.paper });
  // the knowledge graph on both sides of the shortcut; your card joins it in the middle
  const N = [[-160, -30, 'prod'], [-110, -112, 'kn'], [-150, 72, 'att'], [-78, 128, 'kn'], [62, -166, 'kn'], [122, -104, 'att'], [166, -24, 'prod'], [100, 48, 'ink']]
    .map(([x, y, k]) => [cx + x, cy + y, k]);
  const card = [cx, cy - 10];
  for (const [a, b] of [[0, 1], [0, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 7]]) g += line(N[a][0], N[a][1], N[b][0], N[b][1], { stroke: '#A9B4AE', sw: 3.5 });
  for (const i of [0, 3, 6, 7]) g += line(card[0], card[1], N[i][0], N[i][1], { stroke: '#A9B4AE', sw: 3.5 });
  N.forEach(([x, y, k]) => (g += circle(x, y, 14, { fill: C.white, stroke: LAYER[k].strong, sw: 4 })));
  g += caption(cx + 24, cy + 112, 'Knowledge graph', 'one per project', { italic: true, size: 22, subSize: 18, gap: 26 });
  // the outer loop, station to station along the ellipse
  S.forEach(([, , layer, , a0], i) => {
    const a1 = i < S.length - 1 ? S[i + 1][4] : 630, c0 = at(a0), c1 = at(a1), pts = [];
    for (let d = a0; d <= a1; d += 0.5) {
      const p = at(d);
      if (Math.hypot(p[0] - c0[0], p[1] - c0[1]) > r + 16 && Math.hypot(p[0] - c1[0], p[1] - c1[1]) > r + 22) pts.push(p);
    }
    g += path(`M${pts.map(pt).join(' L')}`, { stroke: LAYER[layer].strong, sw: 6, head: layer });
  });
  const onArc = (deg, s, layer, k = 50) => pill(...at(deg, k), s, { color: LAYER[layer].strong });
  g += onArc(286, 'approval', 'att', 56);
  g += onArc(320, 'queued', 'prod', 60);
  g += onArc(435, 'transaction', 'prod', 56);
  g += onArc(477, 'one commit', 'kn', 60);
  // the shortcut: a card you commit yourself lands on the main line as you committed it, with no run and no guard
  const main = at(504), far = Math.hypot(main[0] - card[0], main[1] - card[1]);
  const stop = [main[0] - ((main[0] - card[0]) * (r + 18)) / far, main[1] - ((main[1] - card[1]) * (r + 18)) / far];
  g += line(cx, cy - Ry + r + 12, card[0], card[1] - 44, { stroke: LAYER.att.strong, sw: 5, dash: '14 10' });
  g += line(card[0] - 56, card[1] + 42, stop[0], stop[1], { stroke: LAYER.att.strong, sw: 5, dash: '14 10', head: 'att' });
  g += miniCard(card[0] - 75, card[1] - 40, 150, 80, { crumb: 'YOUR CARD', glyphs: ['verified'], bars: [0.9, 0.7], pad: 14, stroke: LAYER.att.strong, sw: 2.5 });
  S.forEach(([name, ic, layer, sub, deg]) => {
    const [x, y] = at(deg);
    g += medallion(x, y, r, LAYER[layer], ic);
    const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), lx = x + (r + 24) * c, ly = y + (r + 24) * s;
    const anchor = c > 0.4 ? 'start' : c < -0.4 ? 'end' : 'middle';
    const ty = s < -0.9 ? ly - 24 : s > 0.9 ? ly + 18 : ly - 2;
    g += caption(lx, ty, name, sub, { anchor });
  });
  // the three layers
  [['Implementation', 'prod'], ['Understanding', 'kn'], ['Attention', 'att']].forEach(([s, k], i) => {
    const y = 790 + i * 44;
    g += circle(96, y, 13, { fill: LAYER[k].wash, stroke: LAYER[k].strong, sw: 3 }) + text(122, y + 7, s, { size: 21, fill: LAYER[k].strong, bold: true });
  });
  // what you do yourself: runs bypass the queue, cards need no run
  g += pod(1470, 740, 390, 64, 'Your commits: no run, no guard', 'FaPenToSquare', LAYER.att);
  g += pod(1470, 820, 390, 64, 'Your runs: at once', 'FaBolt', LAYER.att);
  return svg(g);
}

// ---------------------------------------------------------------- 2. entities
function entities() {
  let g = '';
  // folder tree: the type is the path
  const rows = [
    [0, 'FaFolderOpen', 'knowledge-graph'], [1, 'FaFolderOpen', 'Governance'], [2, 'FaFolderOpen', 'Decision'],
    [3, 'FaFileLines', 'private-mesh.md', true], [2, 'FaFolder', 'Requirement'], [1, 'FaFolder', 'Product'],
    [1, 'FaFolder', 'Architecture'], [1, 'FaFolder', 'Harness'],
  ];
  const x0 = 70, y0 = 80, dy = 62, ind = 34;
  rows.forEach(([lvl, ic, name, hi], i) => {
    const x = x0 + lvl * ind, y = y0 + i * dy;
    if (hi) g += rect(x - 10, y - 6, 300, 48, { r: 12, fill: LAYER.att.wash });
    if (lvl > 0) g += path(`M${x0 + (lvl - 1) * ind + 14} ${y - 22}V${y + 18}H${x - 4}`, { stroke: C.line, sw: 2.5 });
    g += icon(ic, x, y, 32, hi ? C.accent : lvl === 0 ? C.ink : C.ochre);
    g += text(x + 44, y + 25, name, { size: 22, bold: !!hi, fill: hi ? C.accent : C.ink });
  });
  g += caption(70, 640, 'Type = path', `one directory per type · ${typeCount()} types`, { size: 32 });
  g += path('M380 300 C450 300 450 260 520 260', { stroke: C.accent, sw: 4, head: 'accent' });

  // the card
  const cx = 540, cy = 60, cw = 560, ch = 800;
  g += rect(cx, cy, cw, ch, { r: 24, fill: C.white, stroke: C.line, sw: 1.5, shadow: true });
  g += text(cx + 36, cy + 52, 'GOVERNANCE / DECISION · MOMENTUM', { size: 15, bold: true, fill: C.accent, spacing: 2 });
  g += stateGlyph('unverified', cx + cw - 80, cy + 46, 28) + stateGlyph('synced', cx + cw - 42, cy + 46, 28);
  g += text(cx + 36, cy + 110, 'Remote access over', { head: true, bold: true, size: 36 });
  g += text(cx + 36, cy + 152, 'a private mesh', { head: true, bold: true, size: 36 });
  [0.95, 0.88, 0.6].forEach((b, i) => (g += rect(cx + 36, cy + 190 + i * 22, (cw - 72) * b, 10, { r: 5, fill: C.bar })));
  [0.55, 0.48, 0.62].forEach((b, i) => {
    g += circle(cx + 44, cy + 282 + i * 30, 5, { fill: C.ink }) + rect(cx + 60, cy + 277 + i * 30, (cw - 100) * b, 10, { r: 5, fill: C.bar });
  });
  // a diagram inside the card
  ['Client', 'Mesh', 'API'].forEach((s, i) => {
    const bx = cx + 36 + i * 170;
    g += rect(bx, cy + 390, 128, 60, { r: 10, fill: C.white, stroke: C.ink, sw: 2 }) + text(bx + 64, cy + 427, s, { size: 20, anchor: 'middle' });
    if (i < 2) g += line(bx + 132, cy + 420, bx + 164, cy + 420, { stroke: C.ink, sw: 2.5, head: 'ink' });
  });
  // a table inside the card
  for (let i = 0; i < 4; i++) {
    const ty = cy + 490 + i * 36;
    g += rect(cx + 36, ty, cw - 72, 36, { fill: i ? C.white : C.paper, stroke: C.line, sw: 1.5 });
    g += line(cx + 170, ty, cx + 170, ty + 36, { stroke: C.line, sw: 1.5 });
    if (i) g += rect(cx + 50, ty + 14, 90, 8, { r: 4, fill: C.bar }) + rect(cx + 186, ty + 14, 200 + (i % 2) * 80, 8, { r: 4, fill: C.bar });
  }
  g += text(cx + 50, cy + 514, 'Layer', { size: 16, fill: C.muted, bold: true }) + text(cx + 186, cy + 514, 'Protection', { size: 16, fill: C.muted, bold: true });
  // the character limit
  g += text(cx + 36, cy + 692, 'Card', { size: 18, fill: C.muted, bold: true }) + text(cx + cw - 36, cy + 692, '420 / 700 characters', { size: 18, fill: C.muted, anchor: 'end' });
  g += rect(cx + 36, cy + 708, cw - 72, 16, { r: 8, fill: C.paper }) + rect(cx + 36, cy + 708, (cw - 72) * 0.6, 16, { r: 8, fill: C.ok });
  g += text(cx + cw / 2, cy + 768, 'The entity is its card', { head: true, italic: true, size: 24, anchor: 'middle', fill: C.muted });

  // references
  g += caption(1210, 80, 'References', 'walked by Graph RAG', { size: 28 });
  const chips = [
    [1520, 150, 'FaPlug', 'Session on the API', 'Architecture / Api', 'depends_on', LAYER.prod, 'prod', true],
    [1520, 270, 'FaCubes', 'Mesh feature', 'Product / Feature', 'implements', LAYER.kn, 'kn', false],
    [1520, 390, 'FaTriangleExclamation', 'Clash with the docs', 'Harness / Issue', 'concerns', LAYER.att, 'att', false],
  ];
  chips.forEach(([x, y, ic, name, type, rel, L, hk, outgoing], i) => {
    const sy = cy + 190 + i * 70;
    g += path(`M${cx + cw + 6} ${sy} C${cx + cw + 160} ${sy} ${x - 160} ${y + 36} ${x - 10} ${y + 36}`, { stroke: L.strong, sw: 3.5, head: outgoing ? hk : undefined, tail: outgoing ? undefined : hk });
    g += pill(1360, (sy + y + 36) / 2, rel, { color: L.strong });
    g += rect(x, y, 330, 72, { r: 16, fill: C.white, stroke: L.strong, sw: 2.5, shadow: true });
    g += circle(x + 38, y + 36, 24, { fill: L.wash }) + iconAt(ic, x + 38, y + 36, 24, L.strong);
    g += text(x + 74, y + 32, name, { head: true, bold: true, size: 21 }) + text(x + 74, y + 56, type, { size: 16, fill: C.muted });
  });

  // artifacts beneath a summary
  g += caption(1210, 560, 'Artifacts', 'a summary = entity + artifacts', { size: 28 });
  g += path(`M${cx + cw + 6} ${cy + 620} C1200 ${cy + 620} 1180 680 1240 680`, { stroke: C.ink, sw: 3.5, dash: '10 8' });
  g += path('M1240 680H1800M1300 680V700M1500 680V700M1700 680V700', { stroke: C.ink, sw: 3 });
  [[1240, 'FaFileCode', 'src/server.ts'], [1440, 'FaFileLines', 'plans/mesh.md'], [1640, 'FaComments', 'chats/6fb5.jsonl']].forEach(([x, ic, label]) => {
    g += doc(x, 705, 120, 150, { icon: ic, stroke: C.ink, iconColor: C.ochre });
    g += text(x + 60, 890, label, { size: 18, anchor: 'middle', fill: C.muted });
  });
  return svg(g);
}

// ---------------------------------------------------------------- 3. entity states
function states() {
  let g = '';
  // verification
  g += caption(70, 70, 'Verification', 'your judgement', { size: 32, fill: C.red });
  const U = [230, 390], V = [660, 390], rr = 100;
  for (const [p, st, name, sub] of [[U, 'unverified', 'unverified', 'in the feed'], [V, 'verified', 'verified', 'out of the feed']]) {
    g += circle(p[0], p[1], rr, { fill: STATE[st].wash, stroke: STATE[st].color, sw: 5, shadow: true });
    g += stateGlyph(st, p[0], p[1], 96);
    g += caption(p[0], p[1] + rr + 50, name, sub, { anchor: 'middle', fill: STATE[st].color, size: 28 });
  }
  g += curve(U, V, rr, rr, -95, { stroke: C.ok, sw: 6, head: 'ok' });
  g += iconAt('FaHandPointer', 445, 238, 46, C.ok) + pill(445, 290, 'approval', { color: C.ok });
  g += curve(V, U, rr, rr, -95, { stroke: C.muted, sw: 4, head: 'muted', dash: '12 9' });
  g += pill(445, 488, 'rewritten by a run', { color: C.muted });
  g += line(900, 60, 900, 740, { stroke: C.line, sw: 2 });

  // sync
  g += caption(950, 70, 'Sync', 'the entity against its artifacts and implementation', { size: 32, fill: C.ochre });
  const P = { synced: [1080, 430], entity_ahead: [1430, 230], artifact_ahead: [1430, 640], updating: [1780, 430] }, r = 74;
  g += curve(P.synced, P.entity_ahead, r, r, 30, { label: 'approved, unimplemented', stroke: C.ochre, head: 'kn', dx: -40 });
  g += curve(P.entity_ahead, P.updating, r, r, 30, { label: 'implementation run', stroke: C.ochre, head: 'kn', dx: 40 });
  g += curve(P.synced, P.artifact_ahead, r, r, -30, { label: 'artifact changed', stroke: C.red, head: 'att', dx: -30 });
  g += curve(P.artifact_ahead, P.updating, r, r, -30, { label: 'summarization', stroke: C.red, head: 'att', dx: 30 });
  g += line(P.synced[0] + r + 8, 412, P.updating[0] - r - 14, 412, { stroke: C.muted, sw: 4, head: 'muted' }) + pill(1430, 380, 'run on it', { color: C.muted });
  g += line(P.updating[0] - r - 8, 450, P.synced[0] + r + 14, 450, { stroke: C.ok, sw: 4, head: 'ok' }) + pill(1430, 482, 'landed and approved', { color: C.ok });
  for (const [st, p] of Object.entries(P)) {
    g += circle(p[0], p[1], r, { fill: STATE[st].wash, stroke: STATE[st].color, sw: 5, shadow: true }) + stateGlyph(st, p[0], p[1], 64);
    const below = st !== 'entity_ahead';
    g += text(p[0], below ? p[1] + r + 38 : p[1] - r - 18, st, { head: true, bold: true, size: 26, anchor: 'middle', fill: STATE[st].color });
  }

  // contradictions
  g += rect(60, 780, 1800, 150, { r: 22, fill: C.paper });
  g += caption(100, 840, 'Contradictions', 'open contradiction issues over the entity', { size: 30, fill: C.red });
  const cards = [[900, 802], [1250, 802], [1600, 802]];
  g += path(zigzag([1120, 855], [1250, 855], 10, 7), { stroke: C.red, sw: 4 });
  g += iconAt('FaBolt', 1185, 820, 30, C.red);
  cards.forEach(([x, y], i) => (g += miniCard(x, y, 220, 106, { crumb: i === 2 ? 'PRODUCT / FEATURE' : 'GOVERNANCE / DECISION', crumbSize: 10, bars: [0.9, 0.7, 0.8], badge: i < 2 ? '1' : null, pad: 16 })));
  return svg(g);
}

// ---------------------------------------------------------------- 4. automations
function automations() {
  let g = '';
  const hc = [540, 470];
  const A = [
    ['Exploration', 'FaCompass', 'schedule'], ['Preparation', 'FaListCheck', 'schedule'], ['Implementation', 'FaCode', 'event'],
    ['Validation', 'FaFlaskVial', 'event'], ['Consistency check', 'FaScaleBalanced', 'schedule'], ['Retention', 'FaBroom', 'schedule'],
    ['Optimization', 'FaWandMagicSparkles', 'schedule'], ['Summarization', 'FaFileLines', 'hook'], ['Graph build', 'FaDiagramProject', 'enabled'],
    ['Chat', 'FaComments', 'you'], ['Interview', 'FaMicrophone', 'you'], ['Search', 'FaMagnifyingGlass', 'you'],
  ];
  const KIND = {
    schedule: ['FaClock', C.ochre, 'schedule'], event: ['FaBolt', C.red, 'event'], you: ['FaHandPointer', C.ok, 'you'],
    hook: ['FaAnchor', C.ink, 'Stop hook'], enabled: ['FaPowerOff', C.muted, 'project enabled'],
  };
  const rx = 420, ry = 335, r = 52;
  const pos = A.map((_, i) => {
    const a = ((-90 + (360 / A.length) * i) * Math.PI) / 180;
    return [hc[0] + rx * Math.cos(a), hc[1] + ry * Math.sin(a)];
  });
  pos.forEach(([x, y]) => (g += line(hc[0], hc[1], x, y, { stroke: C.line, sw: 3, dash: '8 8' })));
  g += circle(hc[0], hc[1], 130, { fill: C.paper, stroke: C.white, sw: 8 });
  g += graph(hc[0], hc[1] - 18, 0.82) + text(hc[0], hc[1] + 92, 'Knowledge graph', { head: true, bold: true, size: 22, anchor: 'middle' });
  A.forEach(([name, ic, kind], i) => {
    const [x, y] = pos[i], [kic, kc] = KIND[kind];
    g += medallion(x, y, r, kind === 'you' ? LAYER.att : kind === 'event' ? LAYER.kn : LAYER.prod, ic);
    g += circle(x + r * 0.74, y - r * 0.74, 18, { fill: kc, stroke: C.white, sw: 3 }) + iconAt(kic, x + r * 0.74, y - r * 0.74, 18, C.white);
    g += text(x, y + r + 28, name, { head: true, bold: true, size: 20, anchor: 'middle' });
  });

  // two lanes
  const X = 1100;
  g += caption(X, 80, 'One project, two lanes', null, { size: 32 });
  g += caption(X, 150, 'Automation runs', 'queued, one at a time', { size: 24 });
  [['Exploration', 'FaCompass', 175], ['Implementation', 'FaCode', 205], ['Validation', 'FaFlaskVial', 160], ['Summarization', 'FaFileLines', 185]].reduce((x, [s, ic, w]) => {
    g += pod(x, 205, w, 62, s, ic, LAYER.prod, { size: 17 });
    return x + w + 8;
  }, X);
  g += caption(X, 340, 'Your runs', 'at once, alongside', { size: 24, fill: C.red });
  g += pod(X + 40, 385, 330, 62, 'Chat', 'FaComments', LAYER.att);
  g += pod(X + 230, 462, 330, 62, 'Send back', 'FaRotateLeft', LAYER.att);
  g += pod(X + 420, 539, 320, 62, 'Run on demand', 'FaPlay', LAYER.att);
  g += line(X, 640, 1860, 640, { stroke: C.muted, sw: 3, head: 'muted' }) + text(1860, 672, 'time', { italic: true, size: 19, fill: C.muted, anchor: 'end' });
  // legend
  Object.values(KIND).forEach(([kic, kc, label], i) => {
    const x = X + (i % 2) * 380, y = 735 + Math.floor(i / 2) * 58;
    g += circle(x + 18, y, 18, { fill: kc }) + iconAt(kic, x + 18, y, 18, C.white) + text(x + 48, y + 7, label, { size: 21 });
  });
  return svg(g);
}

// ---------------------------------------------------------------- 5. summarization
function summarization() {
  let g = '';
  g += pod(70, 40, 320, 74, 'A run stops', 'FaTerminal', LAYER.prod);
  const pile = [
    [100, 180, -9, 'FaFileCode', 'server.ts'], [250, 160, 5, 'FaFileLines', 'plan.md'], [400, 190, -4, 'FaComments', 'chat.jsonl'],
    [150, 360, 7, 'FaFileCode', 'api.ts'], [300, 380, -6, 'FaFileLines', 'design.md'], [450, 350, 9, 'FaFileCode', 'guard.ts'],
  ];
  pile.forEach(([x, y, rot, ic, label]) => (g += doc(x, y, 118, 150, { rot, icon: ic, label, stroke: C.ink, iconColor: ic === 'FaComments' ? C.red : C.ok })));
  g += caption(330, 600, "The run's artifacts", 'code, plans, chats, documents', { anchor: 'middle' });
  g += path('M580 330 C640 330 650 270 700 262', { stroke: C.ink, sw: 5, head: 'ink' });

  // the Stop hook and the funnel
  g += iconAt('FaAnchor', 910, 120, 52, C.ink) + caption(955, 115, 'Stop hook', 'before the run ends', { size: 24 });
  g += path('M390 77 C600 77 760 120 870 120', { stroke: C.ink, sw: 3, dash: '10 8', head: 'ink' });
  g += path('M700 250 L1120 250 L975 520 L955 600 L865 600 L845 520 Z', { fill: LAYER.kn.wash, stroke: C.ochre, sw: 5, shadow: true });
  g += `<ellipse cx="910" cy="250" rx="210" ry="28" fill="#E3D6B4" stroke="${C.ochre}" stroke-width="5"/>`;
  g += iconAt('FaWandMagicSparkles', 910, 345, 58, C.ochre);
  g += text(910, 430, 'Summarization', { head: true, bold: true, size: 28, anchor: 'middle' });
  g += text(910, 458, 'sub-agent', { size: 20, anchor: 'middle', fill: C.muted, italic: true });
  g += path('M985 540 C1120 540 1200 440 1300 410', { stroke: C.ochre, sw: 5, head: 'kn' });

  // summary cards
  g += miniCard(1330, 190, 300, 380, { rot: -9, bars: [0.9, 0.8, 0.7, 0.85, 0.6, 0.75, 0.5, 0.8, 0.7] });
  g += miniCard(1540, 190, 300, 380, { rot: 8, bars: [0.9, 0.8, 0.7, 0.85, 0.6, 0.75, 0.5, 0.8, 0.7] });
  let front = miniCard(1430, 170, 310, 400, { crumb: 'HARNESS / CHAT', title: ['Remote access', 'decided'], glyphs: ['unverified', 'synced'], bars: [0.9, 0.82, 0.88, 0.6, 0.78, 0.7, 0.85] });
  front += text(1448, 520, '420 / 700', { size: 16, fill: C.muted }) + rect(1448, 532, 274, 12, { r: 6, fill: C.paper }) + rect(1448, 532, 164, 12, { r: 6, fill: C.ok });
  g += front;
  g += caption(1585, 640, 'Summary entities', 'one card each, within the limit', { anchor: 'middle' });

  // the second path: your own commits
  g += rect(60, 740, 1800, 190, { r: 22, fill: C.paper });
  g += caption(100, 805, 'Your own commits', 'artifacts changed outside a run', { size: 28 });
  const chain = [
    ['FaUser', null, 'your commit', LAYER.att], ['FaFileCode', null, 'artifact changed', LAYER.ink],
    [null, 'artifact_ahead', 'artifact_ahead', LAYER.att], ['FaWandMagicSparkles', null, 'summarization run', LAYER.kn],
    [null, 'synced', 'card rewritten', LAYER.prod],
  ];
  chain.forEach(([ic, st, label, L], i) => {
    const x = 640 + i * 270, y = 818;
    g += circle(x, y, 42, { fill: L.wash, stroke: L.strong, sw: 4 });
    g += ic ? iconAt(ic, x, y, 38, L.strong) : stateGlyph(st, x, y, 44);
    g += text(x, y + 82, label, { size: 20, anchor: 'middle', bold: true, fill: L.strong });
    if (i < chain.length - 1) g += line(x + 52, y, x + 214, y, { stroke: C.muted, sw: 4, head: 'muted' });
  });
  return svg(g);
}

// ---------------------------------------------------------------- 6. consistency guard
function guard() {
  let g = '';
  // the road from the run checkout to the main line
  g += rect(60, 245, 1520, 120, { r: 60, fill: C.paper });
  g += line(140, 305, 1520, 305, { stroke: C.white, sw: 6, dash: '34 22' });
  g += medallion(150, 305, 62, LAYER.prod, 'FaTerminal');
  g += text(150, 210, 'Run checkout', { head: true, bold: true, size: 24, anchor: 'middle' });
  // every write checked on the way
  [320, 410, 500].forEach((x) => (g += circle(x, 245, 22, { fill: C.ochre, stroke: C.white, sw: 4 }) + iconAt('FaBolt', x, 245, 22, C.white)));
  g += text(410, 196, 'every write checked', { size: 21, anchor: 'middle', italic: true, fill: C.ochre });
  // the transaction on the road
  g += miniCard(600, 255, 120, 84, { bars: [0.8, 0.6, 0.7], pad: 14, rot: -6 });
  g += miniCard(630, 262, 120, 84, { bars: [0.8, 0.6, 0.7], pad: 14, rot: 3 });
  g += miniCard(660, 268, 120, 84, { bars: [0.8, 0.6, 0.7], pad: 14 });
  g += text(720, 400, 'transaction', { size: 20, anchor: 'middle', italic: true, fill: C.muted });
  // the guard
  g += rect(830, 150, 34, 260, { r: 8, fill: C.ink }) + rect(1096, 150, 34, 260, { r: 8, fill: C.ink });
  g += rect(810, 120, 340, 64, { r: 14, fill: C.ink, shadow: true });
  [[880, C.ok, 'FaCheck', 'card limit'], [980, C.ok, 'FaCheck', 'type'], [1080, C.red, 'FaXmark', 'references']].forEach(([x, c, ic, label]) => {
    g += circle(x, 152, 21, { fill: c, stroke: C.white, sw: 3 }) + iconAt(ic, x, 152, 22, C.white);
    g += text(x, 98, label, { size: 18, anchor: 'middle', fill: c, bold: true });
  });
  g += text(980, 450, 'Consistency guard', { head: true, bold: true, size: 30, anchor: 'middle' });
  g += text(980, 480, 'everything lands; what fails carries an issue', { size: 20, anchor: 'middle', italic: true, fill: C.muted });
  // after the guard
  g += miniCard(1200, 262, 120, 84, { bars: [0.8, 0.6, 0.7], pad: 14 }) + circle(1312, 266, 15, { fill: C.ok, stroke: C.white, sw: 3 }) + iconAt('FaCheck', 1312, 266, 15, C.white);
  g += miniCard(1340, 262, 120, 84, { bars: [0.8, 0.6, 0.7], pad: 14 }) + circle(1452, 266, 15, { fill: C.red, stroke: C.white, sw: 3 }) + iconAt('FaFlag', 1452, 266, 15, C.white);
  g += line(1470, 305, 1620, 305, { stroke: C.ink, sw: 6, head: 'ink' });
  // the main line
  g += line(1680, 90, 1680, 520, { stroke: C.ink, sw: 14 });
  [140, 220, 305, 400, 470].forEach((y, i) => (g += circle(1680, y, i === 2 ? 28 : 16, { fill: i === 2 ? C.ok : C.white, stroke: i === 2 ? C.white : C.ink, sw: i === 2 ? 6 : 7 })));
  g += text(1735, 300, 'Main line', { head: true, bold: true, size: 28 }) + text(1735, 330, 'one commit', { size: 20, fill: C.muted, italic: true });

  // the consistency check loop
  g += rect(60, 560, 1800, 370, { r: 22, fill: C.paper });
  g += caption(100, 615, 'Consistency check', 'the knowledge graph only', { size: 30 });
  g += graph(420, 810, 1.0, { contradiction: true });
  g += circle(420, 795, 128, { stroke: C.ink, sw: 12 }) + line(512, 887, 556, 922, { stroke: C.ink, sw: 22 });
  g += doc(640, 690, 100, 128, { icon: 'FaEyeSlash', stroke: C.muted, iconColor: C.muted }) + text(690, 860, 'artifacts', { size: 19, anchor: 'middle', fill: C.muted }) + text(690, 884, 'never opened', { size: 19, anchor: 'middle', fill: C.muted });
  g += path('M560 720 C660 650 760 640 860 660', { stroke: C.red, sw: 4, head: 'att' });
  g += miniCard(880, 620, 300, 200, { crumb: 'HARNESS / ISSUE', title: 'Contradiction', flag: true, stroke: C.red, sw: 2.5, bars: [0.85, 0.7, 0.8, 0.5] });
  g += curve([1180, 700], [1400, 680], 0, 30, -20, { stroke: C.red, head: 'att', label: 'concerns' });
  g += curve([1180, 760], [1600, 820], 0, 30, 20, { stroke: C.red, head: 'att', label: 'concerns', dy: 10 });
  g += miniCard(1420, 610, 240, 140, { crumb: 'PRODUCT / FEATURE', crumbSize: 11, bars: [0.85, 0.7, 0.8, 0.6], badge: '1' });
  g += miniCard(1610, 760, 230, 130, { crumb: 'GOVERNANCE / DECISION', crumbSize: 11, bars: [0.85, 0.7, 0.8], badge: '1' });
  g += text(1450, 900, 'counted on each entity', { size: 20, italic: true, fill: C.red, anchor: 'middle' });
  return svg(g);
}

// ---------------------------------------------------------------- 7. issue types
// The categories of automations/consistency-check/agents/momentum-consistency-check.md
function issues() {
  let g = '';
  const tile = (x, y, w, h, [name, ic, sub], L, o = {}) => {
    let s = rect(x, y, w, h, { r: 18, fill: C.white, stroke: C.line, sw: 1.5, shadow: true });
    s += circle(x + 58, y + h / 2, 36, { fill: L.wash, stroke: L.strong, sw: 3 }) + iconAt(ic, x + 58, y + h / 2, 30, L.strong);
    if (o.badge) s += badge(x + 86, y + h / 2 - 30, o.badge);
    s += text(x + 112, y + h / 2 - 8, name, { head: true, bold: true, size: 24 });
    [].concat(sub).forEach((t, i) => (s += text(x + 112, y + h / 2 + 22 + i * 22, t, { size: 18, fill: C.muted })));
    return s;
  };
  // by rule: the guard's checks, over every entity
  g += caption(70, 70, 'By rule', "queries over the graph · the guard's checks", { size: 32, fill: C.ochre });
  [
    ['Reference', 'FaLinkSlash', 'unresolved reference'],
    ['Card limit', 'FaRulerHorizontal', ['card over the', 'character limit']],
    ['Type path', 'FaFolderTree', ['type outside entity-types.tsv', 'or its directory']],
  ].forEach((c, i) => (g += tile(70, 130 + i * 175, 470, 150, c, LAYER.kn)));
  g += line(600, 60, 600, 650, { stroke: C.line, sw: 2 });

  // by reading: the cards themselves, one row per severity
  g += caption(660, 70, 'By reading', 'the cards themselves, never the artifacts', { size: 32, fill: C.red });
  [
    ['High', [
      ['Contradiction', 'FaBolt', ['clash of claims across', 'entities · counted on each']],
      ['Logical', 'FaNotEqual', ['claims of one entity that', 'cannot all be true']],
      ['Ambiguity', 'FaCodeFork', ['wording open to more', 'than one reading']],
    ]],
    ['Medium', [
      ['Design gap', 'FaPuzzlePiece', ['missing flow, mechanism', 'or rule']],
      ['Naming', 'FaTag', ['unintroduced name, or two', 'names for one concept']],
      ['Repetition', 'FaClone', ['same facts restated', 'elsewhere']],
    ]],
    ['Low', [
      ['Verbose', 'FaScissors', ['more words than', 'meaning']],
      ['Struct', 'FaTableCells', ['format that hides', 'the information']],
      ['Split', 'FaObjectGroup', ['fragment of another', 'entity']],
    ]],
  ].forEach(([level, cats], r) => {
    const y = 130 + r * 175;
    // severity: three bars, as many filled as the level is high
    [0, 1, 2].forEach((b) => (g += rect(694 + b * 16, y + 64 - b * 12, 10, 22 + b * 12, { r: 3, fill: b < 3 - r ? C.red : C.bar })));
    g += text(718, y + 116, level, { head: true, bold: true, size: 22, anchor: 'middle', fill: C.red });
    cats.forEach((c, i) => (g += tile(780 + i * 360, y, 340, 150, c, LAYER.att, { badge: r === 0 && i === 0 ? '1' : null })));
  });

  // every finding: one issue
  g += rect(60, 700, 1800, 230, { r: 22, fill: C.paper });
  g += caption(100, 760, 'One issue per finding', 'raised, never fixed by the check', { size: 30 });
  g += miniCard(700, 725, 300, 180, { crumb: 'HARNESS / ISSUE', title: 'Repetition', flag: true, stroke: C.red, sw: 2.5, bars: [0.85, 0.7, 0.5] });
  g += curve([1000, 790], [1200, 770], 0, 30, -16, { stroke: C.red, head: 'att', label: 'concerns' });
  g += curve([1000, 850], [1200, 860], 0, 30, 16, { stroke: C.red, head: 'att', label: 'concerns', dy: 8 });
  g += miniCard(1220, 722, 220, 96, { crumb: 'AT FAULT', crumbSize: 11, bars: [0.85, 0.7], stroke: C.red, sw: 2.5, pad: 16 });
  g += miniCard(1220, 826, 220, 96, { crumb: 'REPEATS IT', crumbSize: 11, bars: [0.85, 0.7], pad: 16 });
  [['FaListCheck', '2–4 options to resolve'], ['FaSliders', 'impact and unlocks, 0–5']].forEach(([ic, s], i) => {
    const y = 790 + i * 70;
    g += iconAt(ic, 1520, y, 30, C.ink) + text(1550, y + 7, s, { size: 21 });
  });
  return svg(g);
}

// ---------------------------------------------------------------- issue resolution
// The options an issue offers, resolved from the feed (apps/app/src/ui/IssueOptions.tsx, approval.ts)
function resolution() {
  let g = '';
  // the issue card in the feed
  g += rect(60, 40, 560, 860, { r: 22, fill: C.white, stroke: C.line, sw: 1.5, shadow: true });
  g += text(92, 92, 'HARNESS / ISSUE', { size: 14, bold: true, fill: C.accent, spacing: 1.5 });
  g += text(92, 138, 'Feed ranked by impact in', { head: true, bold: true, size: 28 });
  g += text(92, 172, 'one entity, by age in another', { head: true, bold: true, size: 28 });
  g += rect(92, 196, 70, 30, { r: 15, fill: C.red }) + text(127, 217, 'High', { size: 15, bold: true, fill: C.white, anchor: 'middle' });
  g += rect(172, 196, 138, 30, { r: 15, fill: LAYER.att.wash }) + text(241, 217, 'Contradiction', { size: 15, bold: true, fill: C.red, anchor: 'middle' });
  [0.92, 0.7].forEach((b, i) => (g += rect(92, 254 + i * 20, 496 * b, 9, { r: 4.5, fill: C.bar })));
  g += text(92, 330, 'Concerns', { size: 17, fill: C.muted });
  g += text(92, 356, 'Product / UserStory / ranking', { size: 17 }) + text(330, 356, 'AT FAULT', { size: 13, bold: true, fill: C.red, spacing: 1.5 });
  g += text(92, 382, 'Frontend / Screen / feed-tab', { size: 17 });
  g += text(92, 446, 'Resolve', { head: true, bold: true, size: 22 });
  ['Rank by impact', 'Rank by age', 'A setting picks the order'].forEach((label, i) => {
    const y = 466 + i * 128, on = i === 0;
    g += rect(92, y, 496, 112, { r: 14, fill: on ? '#F3F8F4' : C.white, stroke: on ? C.ok : C.line, sw: on ? 2.5 : 1.5 });
    g += circle(124, y + 36, 10, { fill: C.white, stroke: on ? C.ok : C.line, sw: on ? 7 : 3 });
    g += text(150, y + 43, label, { size: 21, bold: true });
    if (on) g += text(312, y + 42, 'RECOMMENDED', { size: 13, bold: true, fill: C.ok, spacing: 1.5 });
    [0.8, 0.5].forEach((b, j) => (g += rect(150, y + 64 + j * 18, 400 * b, 8, { r: 4, fill: C.bar })));
  });

  // the three ways out of the card
  const lane = (y, title, sub, color, head, x2) =>
    caption(780, y - 52, title, sub, { anchor: 'middle', fill: color, size: 26, subSize: 18 }) +
    line(640, y, x2, y, { stroke: color, sw: 6, head });
  g += lane(240, 'Swipe right', 'the picked option', C.ok, 'ok', 930);
  g += lane(440, 'Swipe left', 'your own resolution', C.red, 'att', 930);
  g += lane(760, "Won't resolve", 'with the reason', C.red, 'att', 1320);

  // a chat run applies it and retires the issue
  g += rect(940, 160, 280, 340, { r: 34, fill: LAYER.att.wash, stroke: C.red, sw: 2.5, shadow: true });
  g += iconAt('FaComments', 1080, 250, 56, C.red);
  g += text(1080, 320, 'Chat run', { head: true, bold: true, size: 28, anchor: 'middle' });
  ['applies it to the', 'concerned entities', 'and retires the issue'].forEach((s, i) => (g += text(1080, 356 + i * 26, s, { size: 18, fill: C.muted, anchor: 'middle' })));
  g += line(1220, 245, 1320, 245, { stroke: C.ink, sw: 5, head: 'ink' });
  g += line(1220, 455, 1320, 455, { stroke: C.ink, sw: 5, head: 'ink' });
  g += miniCard(1330, 150, 220, 90, { crumb: 'PRODUCT / USERSTORY', crumbSize: 11, bars: [0.85, 0.6], glyphs: ['unverified'], pad: 16 });
  g += miniCard(1350, 256, 220, 90, { crumb: 'FRONTEND / SCREEN', crumbSize: 11, bars: [0.85, 0.6], glyphs: ['unverified'], pad: 16 });
  g += caption(1600, 236, 'Concerned entities', 'changed, unverified, back in the feed', { size: 24, subSize: 18 });
  g += `<g opacity="0.45">${miniCard(1330, 410, 220, 90, { crumb: 'HARNESS / ISSUE', crumbSize: 11, bars: [0.85, 0.6], pad: 16 })}</g>`;
  g += circle(1550, 414, 20, { fill: C.red, stroke: C.white, sw: 3 }) + iconAt('FaXmark', 1550, 414, 20, C.white);
  g += caption(1600, 450, 'Issue retired', 'deleted by the same run', { size: 24, subSize: 18 });

  // won't resolve: kept, verified, with the reason
  g += line(940, 600, 1860, 600, { stroke: C.line, sw: 2 });
  g += miniCard(1330, 690, 220, 140, { crumb: 'HARNESS / ISSUE', crumbSize: 11, bars: [0.85, 0.6], glyphs: ['verified'], pad: 16 });
  g += rect(1346, 776, 188, 34, { r: 8, fill: C.paper }) + text(1440, 799, 'wont_resolve: reason', { size: 14, anchor: 'middle', fill: C.muted });
  g += caption(1600, 746, 'Issue kept, verified', 'with the reason in its frontmatter', { size: 24, subSize: 18 });
  g += text(1600, 806, 'not raised again', { size: 18, fill: C.muted }) + text(1600, 832, 'no longer a contradiction', { size: 18, fill: C.muted });
  return svg(g);
}

// ---------------------------------------------------------------- entity types
const typeRows = () =>
  readFileSync(join(__dirname, 'entity-types.tsv'), 'utf8').split(/\r?\n/).slice(1).map((l) => l.split('\t')).filter(([d, t]) => d && t);
const typeCount = () => typeRows().length;
// Read from docs/entity-types.tsv, so the slide follows the list
function entityTypes() {
  const rows = typeRows();
  const by = new Map();
  for (const [d, t] of rows) by.set(d, [...(by.get(d) ?? []), t]);
  // The app's domain glyphs and light colours (apps/app/src/ui/domains.tsx), with example types
  const D = [
    ['Product', 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5', '#C2410C', ['Feature', 'UserStory', 'Bug', 'Epic']],
    ['Governance', 'M7 20h10M6 6l6-1 6 1M12 3v17M9 12L6 6l-3 6a3 3 0 0 0 6 0M21 12l-3-6-3 6a3 3 0 0 0 6 0', '#7C3AED', ['Requirement', 'Decision', 'Risk', 'Policy']],
    ['Architecture', 'M6 7h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2v-4a4 4 0 0 0-8 0v4H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', '#1D6FD6', ['Service', 'Component', 'Api', 'Event']],
    ['Code', 'M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16', '#15803D', ['Repository', 'SourceFile', 'Function', 'FeatureFlag']],
    ['Data', 'M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0M4 6v6a8 3 0 0 0 16 0V6M4 12v6a8 3 0 0 0 16 0v-6', '#0F766E', ['Schema', 'DbTable', 'Migration', 'Dataset']],
    ['Frontend', 'M6 4h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', '#C0266D', ['Screen', 'Form', 'UiComponent', 'DesignToken']],
    ['Testing', 'M9 3h6M10 9h4M10 3v6L6 20a.7.7 0 0 0 .5 1h11a.7.7 0 0 0 .5-1l-4-11V3', '#A16207', ['TestCase', 'TestSuite', 'TestRun', 'Mock']],
    ['Security', 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3', '#C62828', ['Role', 'Permission', 'Threat', 'Vulnerability']],
    ['Infrastructure', 'M6 4h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM6 12h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3zM7 8v.01M7 16v.01', '#52606A', ['Deployment', 'Cluster', 'Metric', 'Incident']],
    ['Organization', 'M5 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85', '#8A5A2B', ['Team', 'Person', 'Vendor', 'Customer']],
    ['Knowledge', 'M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13', '#0369A1', ['MeetingNote', 'Faq', 'HowToGuide', 'ReleaseNote']],
    ['Harness', 'M8 4h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 2v2M9 12v9M15 12v9M5 16l4-2M15 14l4 2M9 18h6M10 8v.01M14 8v.01', '#B85042', ['Automation', 'Trigger', 'Issue', 'Chat']],
  ];
  for (const [d, , , ex] of D) for (const t of ex) if (!by.get(d)?.includes(t)) throw new Error(`${d}/${t} is not in entity-types.tsv`);
  const glyph = (d, cx, cy, size, color) =>
    `<g transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${n((size / 24) * 1000) / 1000})"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  let g = caption(70, 62, `${rows.length} types in ${by.size} domains`, 'the type is the path: knowledge-graph/<Domain>/<Type>/ · examples below', { size: 30 });
  const cols = 4, gx = 24, gy = 24, x0 = 60, y0 = 116, w = (1800 - gx * (cols - 1)) / cols, h = (H - y0 - 30 - gy * 2) / 3;
  D.forEach(([d, p, color, ex], i) => {
    const x = x0 + (i % cols) * (w + gx), y = y0 + Math.floor(i / cols) * (h + gy);
    g += rect(x, y, w, h, { r: 18, fill: C.white, stroke: C.line, sw: 1.5, shadow: true });
    g += rect(x, y + 18, 6, h - 36, { r: 3, fill: color });
    g += `<circle cx="${n(x + 58)}" cy="${n(y + 58)}" r="34" fill="${color}" fill-opacity="0.16"/>` + glyph(p, x + 58, y + 58, 38, color);
    g += text(x + 108, y + 56, d, { head: true, bold: true, size: 26, fill: color });
    g += text(x + 108, y + 82, `${by.get(d).length} types`, { size: 17, fill: C.muted });
    ex.forEach((t, j) => {
      const cw = (w - 56 - 12) / 2, cx = x + 28 + (j % 2) * (cw + 12), cy = y + 112 + Math.floor(j / 2) * 46;
      g += `<rect x="${n(cx)}" y="${n(cy)}" width="${n(cw)}" height="36" rx="18" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-opacity="0.35" stroke-width="1.5"/>`;
      g += text(cx + cw / 2, cy + 24, t, { size: 17, anchor: 'middle' });
    });
  });
  return svg(g);
}

// ---------------------------------------------------------------- triggers
// The trigger entities of automations/*/trigger.md
function triggers() {
  let g = '';
  // the day: schedules
  g += caption(70, 62, 'Schedule', 'cron, in each trigger entity', { size: 30, fill: C.ok });
  const X0 = 360, X1 = 1840, hx = (t) => X0 + ((X1 - X0) * t) / 24;
  const lanes = [
    ['Exploration', 'FaCompass', 'every 2 hours', Array.from({ length: 12 }, (_, i) => i * 2)],
    ['Preparation', 'FaListCheck', 'every 2 hours, at half past', Array.from({ length: 12 }, (_, i) => i * 2 + 0.5)],
    ['Validation', 'FaFlaskVial', '02:00', [2]],
    ['Consistency check', 'FaScaleBalanced', '03:00', [3]],
    ['Retention', 'FaBroom', '04:00', [4]],
    ['Optimization', 'FaWandMagicSparkles', '05:00', [5]],
  ];
  for (let t = 0; t <= 24; t += 2) {
    g += line(hx(t), 100, hx(t), 100 + lanes.length * 46 + 6, { stroke: C.line, sw: 1.5 });
    g += text(hx(t), 96, `${String(t).padStart(2, '0')}:00`, { size: 15, anchor: 'middle', fill: C.muted });
  }
  lanes.forEach(([name, ic, when, at], i) => {
    const y = 130 + i * 46;
    g += iconAt(ic, 86, y, 24, C.ok) + text(110, y + 7, name, { size: 20, bold: true });
    g += line(X0, y, X1, y, { stroke: C.bar, sw: 2 });
    at.forEach((t) => (g += circle(hx(t), y, 9, { fill: C.ok, stroke: C.white, sw: 2.5 })));
    if (at.length === 1) g += text(hx(at[0]) + 20, y + 6, when, { size: 17, fill: C.muted, italic: true });
  });

  // events
  const ey = 470;
  g += caption(70, ey, 'Events', 'one run starts the next', { size: 30, fill: C.ochre });
  const chain = (y, from, fromIc, ev, to, toIc) => {
    let s = pod(70, y, 300, 60, from, fromIc, LAYER.ink, { size: 18 });
    s += line(380, y + 30, 560, y + 30, { stroke: C.ochre, sw: 4, head: 'kn' }) + pill(470, y + 30 - 24, ev, { color: C.ochre, size: 15 });
    return s + pod(570, y, 260, 60, to, toIc, LAYER.kn, { size: 18 });
  };
  g += chain(ey + 40, 'Approved, unimplemented', 'FaHandPointer', 'entity_ahead', 'Implementation', 'FaCode');
  g += chain(ey + 120, 'Implementation finished', 'FaCodeCommit', 'implementation_finished', 'Validation', 'FaFlaskVial');

  // on demand
  g += caption(70, ey + 250, 'On demand', 'every trigger entity · chat on demand only', { size: 30, fill: C.red });
  g += pod(70, ey + 290, 300, 60, 'Run on demand', 'FaPlay', LAYER.att, { size: 18 });
  g += pod(400, ey + 290, 220, 60, 'Chat', 'FaComments', LAYER.att, { size: 18 });

  // the trigger entity
  const cx = 960, cy = 440, cw = 460;
  g += rect(cx, cy, cw, 300, { r: 18, fill: C.white, stroke: C.line, sw: 1.5, shadow: true });
  g += text(cx + 24, cy + 40, 'HARNESS / TRIGGER', { size: 13, bold: true, fill: C.accent, spacing: 2 });
  g += text(cx + 24, cy + 80, 'Consistency check trigger', { head: true, bold: true, size: 24 });
  [['automation', 'consistency-check'], ['schedule', '"0 3 * * *"'], ['events', '[]'], ['on_demand', 'true']].forEach(([k, v], i) => {
    const y = cy + 130 + i * 36;
    g += text(cx + 24, y, `${k}:`, { size: 19, fill: C.muted }) + text(cx + 170, y, v, { size: 19, bold: true });
  });
  g += text(cx + 24, cy + 278, 'one per automation, in each workspace', { size: 17, italic: true, fill: C.muted });

  // no trigger entity
  const nx = 1470;
  g += caption(nx, ey, 'No trigger entity', null, { size: 26 });
  g += pod(nx, ey + 40, 370, 60, 'Summarization', 'FaFileLines', LAYER.ink, { size: 18 }) + text(nx + 20, ey + 128, 'Stop hook of every run', { size: 17, italic: true, fill: C.muted });
  g += pod(nx, ey + 160, 370, 60, 'Graph build', 'FaDiagramProject', LAYER.ink, { size: 18 }) + text(nx + 20, ey + 248, 'project enabled, until covered', { size: 17, italic: true, fill: C.muted });
  // the feed limit
  g += rect(nx, ey + 290, 370, 70, { r: 16, fill: C.paper });
  g += iconAt('FaPause', nx + 36, ey + 325, 26, C.red) + text(nx + 66, ey + 320, 'Feed at its limit', { size: 19, bold: true }) + text(nx + 66, ey + 344, 'scheduled loops pause', { size: 16, fill: C.muted });
  return svg(g);
}

// ---------------------------------------------------------------- automation management
function management() {
  let g = '';
  // the harness workspace: one definition per automation
  g += rect(60, 60, 560, 520, { r: 22, fill: C.paper });
  g += caption(100, 112, 'Harness workspace', 'one definition per automation', { size: 26 });
  g += miniCard(100, 160, 300, 210, { crumb: 'HARNESS / AUTOMATION', crumbSize: 11, title: ['Consistency check'], glyphs: ['verified'], bars: [0.9, 0.75, 0.85, 0.6] });
  g += path('M400 300 C440 300 440 420 470 420', { stroke: C.ink, sw: 3, dash: '9 7' });
  g += doc(440, 420, 110, 136, { icon: 'FaRobot', stroke: C.ink, iconColor: C.ochre });
  g += text(100, 420, 'artifacts: the Claude Code', { size: 18, fill: C.muted }) + text(100, 444, 'files of the automation', { size: 18, fill: C.muted });
  g += text(100, 510, 'automations/<name>/agents/', { size: 17, fill: C.ink, bold: true });
  g += text(100, 534, 'momentum-<name>.md', { size: 17, fill: C.ink, bold: true });

  // each workspace: one trigger per automation
  g += rect(60, 610, 560, 320, { r: 22, fill: C.paper });
  g += caption(100, 662, 'Each workspace', 'one trigger per automation', { size: 26 });
  [0, 1, 2].forEach((i) => (g += miniCard(100 + i * 30, 700 + i * 22, 300, 150, { crumb: 'HARNESS / TRIGGER', crumbSize: 11, bars: [0.6, 0.8, 0.5] })));
  g += text(500, 790, 'schedule', { size: 18, fill: C.muted }) + text(500, 816, 'events', { size: 18, fill: C.muted }) + text(500, 842, 'on demand', { size: 18, fill: C.muted });

  // two ways in, one path
  const y = 360;
  g += pod(720, 200, 300, 66, 'Your edit', 'FaPenToSquare', LAYER.att);
  g += pod(720, 460, 300, 66, 'Optimization', 'FaWandMagicSparkles', LAYER.prod);
  g += text(870, 560, 'proposes what repeats', { size: 18, italic: true, fill: C.muted, anchor: 'middle' }) + text(870, 584, 'three times across chats', { size: 18, italic: true, fill: C.muted, anchor: 'middle' });
  g += path(`M1020 233 C1250 233 1370 233 1370 ${y - 62}`, { stroke: C.red, sw: 4, head: 'att' });
  g += text(1195, 222, 'as you commit it', { size: 18, italic: true, fill: C.muted, anchor: 'middle' });
  g += path(`M1020 493 C1080 493 1080 ${y} 1130 ${y}`, { stroke: C.ok, sw: 4, head: 'ok' });
  const steps = [['FaShieldHalved', 'Consistency guard', LAYER.kn], ['FaCodeCommit', 'Main line', LAYER.kn], ['FaLayerGroup', 'Feed', LAYER.att], ['FaCircleCheck', 'Verified', LAYER.prod]];
  steps.forEach(([ic, s, L], i) => {
    const x = 1190 + i * 180;
    g += medallion(x, y, 52, L, ic, { k: 0.75 });
    g += text(x, y + 88, s, { head: true, bold: true, size: 20, anchor: 'middle' });
    if (i < steps.length - 1) g += line(x + 60, y, x + 112, y, { stroke: C.muted, sw: 4, head: 'muted' });
  });
  g += text(1460, y + 150, 'like any other entity', { head: true, italic: true, size: 26, anchor: 'middle', fill: C.muted });

  // controls
  g += line(680, 680, 1860, 680, { stroke: C.line, sw: 2 });
  [
    ['FaPlay', 'Run on demand', 'from the chat'], ['FaStop', 'Stop a run', 'what it wrote lands'],
    ['FaMicrochip', 'Models', 'settings: per automation'], ['FaLayerGroup', 'Concurrent runs', 'settings: in total'],
  ].forEach(([ic, name, sub], i) => {
    const x = 740 + (i % 2) * 560, yy = 760 + Math.floor(i / 2) * 110;
    g += circle(x, yy, 40, { fill: C.white, stroke: C.ink, sw: 3, shadow: true }) + iconAt(ic, x, yy, 34, C.ink);
    g += text(x + 60, yy - 4, name, { head: true, bold: true, size: 22 }) + text(x + 60, yy + 22, sub, { size: 18, fill: C.muted });
  });
  return svg(g);
}

// ---------------------------------------------------------------- settings
// The sections of the app's Settings tab (apps/app/src/app/(tabs)/settings.tsx), with the harness defaults
function settings() {
  let g = '';
  const sw = (x, y, on) => rect(x, y, 46, 26, { r: 13, fill: on ? C.ok : C.line }) + circle(on ? x + 33 : x + 13, y + 13, 10, { fill: C.white });
  const num = (x, y, v) => rect(x - 64, y, 64, 30, { r: 8, fill: C.paper }) + text(x - 32, y + 21, v, { size: 17, anchor: 'middle' });
  const chev = (x, y) => path(`M${x - 12} ${y - 7} L${x - 4} ${y} L${x - 12} ${y + 7}`, { stroke: C.muted, sw: 2.5 });
  const seg = (x, y, w, opts, on) => {
    let s = rect(x, y, w, 32, { r: 8, fill: C.paper });
    const sw2 = w / opts.length;
    opts.forEach((o, i) => {
      if (i === on) s += rect(x + i * sw2 + 3, y + 3, sw2 - 6, 26, { r: 6, fill: C.white, shadow: true });
      s += text(x + i * sw2 + sw2 / 2, y + 21, o, { size: 14, anchor: 'middle', bold: i === on, fill: i === on ? C.ink : C.muted });
    });
    return s;
  };
  const row = (x, y, w, title, sub, ctl) =>
    text(x + 20, y + (sub ? 24 : 38), title, { size: 18 }) + (sub ? text(x + 20, y + 46, sub, { size: 14, fill: C.muted }) : '') + ctl(x + w - 20, y + 16);
  const sections = [
    ['Appearance', 'FaCircleHalfStroke', [['Theme', 'this device only', (r, y) => seg(r - 240, y, 240, ['System', 'Light', 'Dark'], 0)]]],
    ['Included projects', 'FaToggleOn', [
      ['momentum', 'enabled: loops run', (r, y) => sw(r - 46, y + 2, true)],
      ['stock-fly', 'disabled: no loops', (r, y) => sw(r - 46, y + 2, false)],
      ['Knowledge graph', 'build: stop, resume, reset', (r, y) => chev(r, y + 14)],
    ]],
    ['Feed size', 'FaLayerGroup', [['Items before loops pause', null, (r, y) => num(r, y, '40')]]],
    ['Cards', 'FaIdCard', [['Character limit', 'a card fits on a mobile screen', (r, y) => num(r, y, '700')], ['Presentation rules', null, (r, y) => chev(r, y + 14)]]],
    ['Summarization', 'FaFileLines', [['Never summarized', 'path patterns, such as **/*.lock', (r, y) => chev(r, y + 14)]]],
    ['Lifetimes', 'FaHourglassHalf', [
      ['Product/DevTask', '30 days after resolved, unless referenced', (r, y) => chev(r, y + 14)],
      ['Harness/Research', '60 days after delivered', (r, y) => chev(r, y + 14)],
      ['Governance/Decision', 'kept while referenced', (r, y) => chev(r, y + 14)],
    ]],
    ['Agents', 'FaTerminal', [['Concurrent runs in total', 'across projects', (r, y) => num(r, y, '8')]]],
    ['Models', 'FaMicrochip', [
      ['Mode', null, (r, y) => seg(r - 330, y, 330, ['One model', 'Per automation', 'By risk'], 2)],
      ['Implementation, low risk', 'Haiku', (r, y) => chev(r, y + 14)],
      ['Implementation, medium risk', 'Sonnet', (r, y) => chev(r, y + 14)],
      ['Implementation, high risk', 'Opus', (r, y) => chev(r, y + 14)],
    ]],
    ['In the knowledge graph', 'FaDiagramProject', [
      ['Automations, entity types, risk rules', 'opened where they live, changed through the feed', (r, y) => chev(r, y + 14)],
      ['momentum', 'triggers · patterns', (r, y) => chev(r, y + 14)],
    ]],
  ];
  const cols = [[0, 1, 2, 3, 8], [4, 5, 6, 7]], w = 880, rh = 64;
  cols.forEach((ids, c) => {
    let y = 40;
    const x = 60 + c * (w + 40);
    ids.forEach((id) => {
      const [name, ic, rows] = sections[id];
      g += iconAt(ic, x + 14, y + 16, 24, C.accent) + text(x + 40, y + 24, name, { head: true, bold: true, size: 22 });
      y += 40;
      g += rect(x, y, w, rows.length * rh, { r: 14, fill: C.white, stroke: C.line, sw: 1.5, shadow: true });
      rows.forEach(([t, sub, ctl], j) => {
        if (j) g += line(x, y + j * rh, x + w, y + j * rh, { stroke: C.line, sw: 1.5 });
        g += row(x, y + j * rh, w, t, sub, ctl);
      });
      y += rows.length * rh + 26;
    });
  });
  return svg(g);
}

// ---------------------------------------------------------------- 8. git
function git() {
  let g = '';
  const Y = 540;
  g += line(80, Y, 1860, Y, { stroke: C.ink, sw: 14 });
  g += text(80, Y + 70, 'Main line', { head: true, bold: true, size: 28 }) + text(80, Y + 98, 'the only branch', { size: 20, italic: true, fill: C.muted });
  const commit = (x, color, label, o = {}) => {
    let s = circle(x, Y, 24, { fill: o.fill ? color : C.white, stroke: o.fill ? C.white : color, sw: o.fill ? 6 : 9 });
    if (o.icon) s += iconAt(o.icon, x, Y, 22, C.white);
    return s + text(x, Y + 64, label, { size: 20, anchor: 'middle', bold: true, fill: color });
  };
  // a run that lands on an unchanged main line: fast-forward
  g += pod(200, 340, 250, 66, 'Exploration', 'FaCompass', LAYER.prod);
  g += path(`M300 ${Y - 26} C300 470 230 430 230 412`, { stroke: C.ink, sw: 3, dash: '9 8' });
  g += path(`M430 406 C470 440 480 480 480 ${Y - 32}`, { stroke: C.ok, sw: 5, head: 'ok' });
  g += pill(560, 450, 'fast-forward', { color: C.ok });
  // a run that lands after your commit: replayed, conflicts raised
  g += pod(760, 330, 300, 66, 'Implementation', 'FaCode', LAYER.prod);
  g += path(`M680 ${Y - 26} C680 450 760 420 780 400`, { stroke: C.ink, sw: 3, dash: '9 8' });
  g += path(`M1050 396 C1130 430 1180 470 1180 ${Y - 32}`, { stroke: C.ok, sw: 5, head: 'ok' });
  g += iconAt('FaBolt', 1158, 452, 34, C.red) + pill(1050, 480, 'replayed', { color: C.ok });
  g += path(`M1180 ${Y + 90} V${Y + 128}`, { stroke: C.red, sw: 3, dash: '6 6' });
  g += miniCard(1080, Y + 130, 260, 120, { crumb: 'HARNESS / CONFLICT', title: 'Changed meanwhile', titleSize: 18, flag: true, stroke: C.red, sw: 2.5, bars: [0.8, 0.6] });
  // your chat, at once, alongside
  g += pod(820, 150, 300, 66, 'Your chat', 'FaComments', LAYER.att);
  g += path(`M690 ${Y - 26} C700 300 760 190 820 183`, { stroke: C.red, sw: 3, dash: '9 8' });
  g += path(`M1120 183 C1300 183 1400 300 1400 ${Y - 32}`, { stroke: C.ok, sw: 5, head: 'ok' });
  g += pill(1270, 210, 'at once, alongside', { color: C.red });
  // queued automation runs, one at a time
  g += text(1700, 100, 'queued, one at a time', { size: 21, anchor: 'middle', italic: true, fill: C.ok });
  g += pod(1560, 125, 280, 58, 'Validation', 'FaFlaskVial', LAYER.prod, { ghost: true, size: 18 });
  g += pod(1560, 195, 280, 58, 'Retention', 'FaBroom', LAYER.prod, { ghost: true, size: 18 });
  g += pod(1560, 265, 280, 58, 'Preparation', 'FaListCheck', LAYER.prod, { ghost: true, size: 18 });
  g += path(`M1700 330 V${Y - 32}`, { stroke: C.ok, sw: 5, head: 'ok' });
  // the commits
  g += commit(300, C.ink, 'tip');
  g += commit(480, C.ok, 'landed', { fill: true });
  g += commit(680, C.ok, 'approval', { fill: true, icon: 'FaCheck' });
  g += commit(900, C.red, 'your commit', { fill: true, icon: 'FaUser' });
  g += commit(1180, C.ok, 'landed', { fill: true });
  g += commit(1400, C.ok, 'chat landed', { fill: true });
  g += commit(1700, C.ok, 'next run', { fill: true });

  g += iconAt('FaLaptopCode', 1480, 845, 64, C.ink);
  g += caption(1530, 840, 'Your checkout follows', 'clean files updated, dirty ones left alone', { size: 26 });
  return svg(g);
}

// ---------------------------------------------------------------- 9. user actions
function actions() {
  let g = '';
  // the phone with a feed card
  const px = 810, py = 110, pw = 300, ph = 600;
  g += rect(px, py, pw, ph, { r: 46, fill: '#F7F5F0', stroke: C.ink, sw: 14, shadow: true });
  g += rect(px + pw / 2 - 50, py + 18, 100, 22, { r: 11, fill: C.ink });
  g += miniCard(px + 30, py + 70, pw - 60, 420, { crumb: 'PRODUCT / FEATURE', crumbSize: 11, title: ['Offline feed'], glyphs: ['unverified'], bars: [0.9, 0.8, 0.86, 0.6, 0.8, 0.7, 0.85, 0.5, 0.75, 0.6, 0.8, 0.7, 0.66, 0.8] });
  ['FaLayerGroup', 'FaDiagramProject', 'FaComments', 'FaChartLine', 'FaGear'].forEach((ic, i) => (g += iconAt(ic, px + 50 + i * 50, py + ph - 52, 24, i ? C.muted : C.accent)));

  // swipe left: send back
  g += caption(430, 70, 'Swipe left', 'send back with a comment', { anchor: 'middle', fill: C.red, size: 32 });
  g += rect(280, 140, 300, 120, { r: 22, fill: C.white, stroke: C.red, sw: 3, shadow: true });
  g += path('M480 258 L510 300 L520 258', { fill: C.white, stroke: C.red, sw: 3 });
  [0.85, 0.7, 0.5].forEach((b, i) => (g += rect(305, 172 + i * 26, 250 * b, 10, { r: 5, fill: '#EBC9C1' })));
  g += path('M790 420 C700 470 620 470 560 420', { stroke: C.red, sw: 10, head: 'att' });
  g += iconAt('FaHandPointer', 680, 500, 56, C.ink);
  g += line(430, 320, 430, 548, { stroke: C.red, sw: 4, head: 'att' });
  g += pod(270, 560, 330, 70, 'Chat run on it', 'FaComments', LAYER.att);
  g += stateGlyph('updating', 370, 680, 32) + text(395, 690, 'updating', { size: 22, bold: true, fill: STATE.updating.color });

  // swipe right: approve
  g += caption(1490, 70, 'Swipe right', 'approve', { anchor: 'middle', fill: C.ok, size: 32 });
  g += path('M1130 420 C1220 470 1300 470 1360 420', { stroke: C.ok, sw: 10, head: 'ok' });
  g += iconAt('FaHandPointer', 1240, 500, 56, C.ink);
  g += circle(1450, 330, 70, { fill: STATE.verified.wash, stroke: C.ok, sw: 5, shadow: true }) + stateGlyph('verified', 1450, 330, 64);
  g += text(1450, 200, 'APPROVE', { size: 26, bold: true, fill: C.ok, anchor: 'middle', spacing: 3, rot: -8 });
  g += line(1450, 410, 1450, 520, { stroke: C.ok, sw: 4, head: 'ok' });
  g += line(1300, 560, 1860, 560, { stroke: C.ink, sw: 12 });
  g += circle(1350, 560, 14, { fill: C.white, stroke: C.ink, sw: 6 }) + circle(1450, 560, 24, { fill: C.ok, stroke: C.white, sw: 6 }) + iconAt('FaCheck', 1450, 560, 22, C.white);
  g += text(1450, 615, 'one commit on the main line', { size: 20, anchor: 'middle', bold: true, fill: C.ok });
  g += path('M1480 540 C1560 480 1600 470 1620 470', { stroke: C.ochre, sw: 4, head: 'kn', dash: '10 8' });
  g += pod(1630, 437, 230, 66, 'Implement', 'FaCode', LAYER.kn, { size: 19 });
  g += text(1745, 420, 'when nothing implements it', { size: 19, italic: true, fill: C.ochre, anchor: 'middle' });

  // everything else you do
  g += line(60, 760, 1860, 760, { stroke: C.line, sw: 2 });
  [
    ['FaComments', 'Chat', 'ask, steer'], ['FaPlay', 'Run on demand', 'any automation'], ['FaStop', 'Stop a run', 'what it wrote lands'],
    ['FaToggleOn', 'Projects', 'enable, build, reset'], ['FaPenToSquare', 'Edit entities', 'commit to main'], ['FaGear', 'Settings', 'limits, models'],
  ].forEach(([ic, name, sub], i) => {
    const x = 220 + i * 296;
    g += circle(x, 830, 42, { fill: C.white, stroke: C.ink, sw: 3, shadow: true }) + iconAt(ic, x, 830, 36, C.ink);
    g += text(x + 60, 826, name, { head: true, bold: true, size: 22 }) + text(x + 60, 852, sub, { size: 18, fill: C.muted });
  });
  return svg(g);
}

// ---------------------------------------------------------------- agent tools
function tools() {
  let g = '';
  const PW = 568, PH = 410, X = [70, 70 + PW + 36, 70 + 2 * (PW + 36)], Y = [70, 510];
  // a paper panel: medallion, crumb, title and what it is for
  const panel = (x, y, layer, ic, crumb, title, sub) => {
    g += rect(x, y, PW, PH, { r: 24, fill: C.paper });
    g += medallion(x + 72, y + 76, 44, layer, ic, { color: layer.strong, k: 0.7 });
    g += text(x + 134, y + 50, crumb, { size: 13, bold: true, fill: C.accent, spacing: 1.5 });
    g += caption(x + 134, y + 82, title, sub, { size: 26, subSize: 18, gap: 27 });
  };
  // one tool per line: its name and what it does
  const rows = (x, y, items, layer) =>
    items.forEach(([name, what], i) => {
      const yy = y + 160 + i * 50;
      if (i) g += line(x + 36, yy - 32, x + PW - 36, yy - 32, { stroke: C.line, sw: 1.5 });
      g += text(x + 36, yy, name, { size: 20, bold: true, fill: layer.strong }) + text(x + 248, yy, what, { size: 18, fill: C.muted });
    });
  // tools as chips, flowed into the panel
  const chips = (x, y, names, o = {}) => {
    const size = o.size ?? 19, h = size + 22, gap = o.gap ?? 12;
    let cx = x + 36, cy = y + 140;
    for (const s of names) {
      const w = s.length * size * 0.52 + 30;
      if (cx + w > x + PW - 36) (cx = x + 36), (cy += h + gap);
      g += rect(cx, cy, w, h, { r: h / 2, fill: C.white, stroke: C.line, sw: 1.5 });
      g += text(cx + w / 2, cy + h / 2 + size * 0.35, s, { size, anchor: 'middle', bold: o.bold ?? true, fill: o.color ?? C.ink });
      cx += w + gap;
    }
  };
  // two lines per item: a named thing and what it does
  const pairs = (x, y, items, layer, ic) =>
    items.forEach(([name, what], i) => {
      const yy = y + 168 + i * 92;
      g += circle(x + 62, yy, 26, { fill: C.white, stroke: layer.strong, sw: 2.5 }) + iconAt(ic, x + 62, yy, 24, layer.strong);
      g += text(x + 104, yy - 4, name, { size: 21, bold: true }) + text(x + 104, yy + 23, what, { size: 18, fill: C.muted });
    });
  const foot = (x, y, s, layer) => (g += text(x + 36, y + PH - 30, s, { size: 17, italic: true, fill: layer?.strong ?? C.muted }));

  // 1. Claude Code's own tools
  panel(X[0], Y[0], LAYER.ink, 'FaTerminal', 'CLAUDE CODE', 'Built-in tools', 'files, shell and web in the run\'s checkout');
  chips(X[0], Y[0], ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch', 'Agent', 'Skill', 'TodoWrite']);
  foot(X[0], Y[0], 'project settings, permissions bypassed, limits per process');

  // 2. the knowledge base
  panel(X[1], Y[0], LAYER.kn, 'FaDiagramProject', 'MCP · IN-PROCESS', 'momentum-kb', 'the knowledge base of the workspace');
  rows(X[1], Y[0], [
    ['search', 'text, semantic, Graph RAG'],
    ['read · references', 'an entity, its links both ways'],
    ['types', 'entity types, what each is for'],
    ['write', 'an entity, validated on write'],
    ['record_agent_metric', 'misalignments, recurring'],
  ], LAYER.kn);

  // 3. reports to the harness
  panel(X[2], Y[0], LAYER.prod, 'FaClipboardCheck', 'MCP · IN-PROCESS', 'momentum-run', 'what the run reports to the harness');
  rows(X[2], Y[0], [
    ['report_graph_build', 'coverage, next, documents'],
    ['report_interview', 'next question, done'],
  ], LAYER.prod);
  // the graph build's coverage, as the observer shows it
  const bx = X[2] + 36, by = Y[0] + 270, bw = PW - 72;
  g += text(bx, by, 'Knowledge graph build', { size: 17, bold: true }) + text(bx + bw, by, '62%', { size: 17, bold: true, fill: C.ok, anchor: 'end' });
  g += rect(bx, by + 14, bw, 16, { r: 8, fill: C.white, stroke: C.line, sw: 1.5 }) + rect(bx, by + 14, bw * 0.62, 16, { r: 8, fill: C.ok });
  foot(X[2], Y[0], 'report_interview in interview runs only');

  // 4. sub-agents
  panel(X[0], Y[1], LAYER.prod, 'FaRobot', 'AGENT TOOL', 'Sub-agents', 'work handed off inside the run');
  pairs(X[0], Y[1], [
    ['momentum-summarization', 'artifacts into entities, at Stop'],
  ], LAYER.prod, 'FaRobot');
  foot(X[0], Y[1], 'from .claude/agents of the project');

  // 5. hooks around the tools
  panel(X[1], Y[1], LAYER.kn, 'FaShieldHalved', 'CLAUDE CODE HOOKS', 'Hooks on the tools', 'the consistency guard inside the run');
  pairs(X[1], Y[1], [
    ['PostToolUse', 'every write: the guard\'s issues at once'],
    ['Stop · SubagentStop', 'summarize, fix issues, commit message'],
  ], LAYER.kn, 'FaBolt');
  foot(X[1], Y[1], 'Write · Edit · MultiEdit · NotebookEdit · kb write');

  // 6. the user's voice tools: the API as MCP
  panel(X[2], Y[1], LAYER.att, 'FaMicrophone', 'MCP · HTTP /mcp', 'momentum', 'the user\'s voice tools: the API, no UI');
  chips(X[2], Y[1], [
    'feed', 'approve', 'send_back', 'ask', 'resolve_issue', 'wont_resolve_issue', 'entity', 'types', 'search', 'chats', 'chat', 'run_automation',
    'run', 'message', 'kill_run', 'graph_build', 'set_graph_build', 'reset_project', 'metrics', 'timeline', 'settings', 'update_settings', 'workspaces',
  ], { size: 14, gap: 7, bold: false, color: LAYER.att.strong });
  return svg(g);
}

// ---------------------------------------------------------------- slides
const SLIDES = [
  ['How everything works together', loop, 'One loop per project. Triggers queue runs; each run works in its own checkout of the main line; summarization turns its artifacts into cards; the consistency guard validates the transaction and lands it as one commit; the index follows the main line and the feed ranks what is unverified; the user approves, sends back or chats. A card the user commits needs no run and no guard: it lands as committed, and the consistency check reads it like any other. Runs the user starts go at once, alongside the queued automation runs.'],
  ['Entities', entities, 'The unit of the knowledge base. The type is the path on disk. The entity is its card, within the character limit. References link entities and are walked by Graph RAG. A summary is an entity with artifacts beneath it.'],
  ['Entity types', entityTypes, 'Every entity has one of the types in docs/entity-types.tsv, grouped in domains, each with the colour and glyph the app shows; four examples per domain. The type is the path of the entity in the knowledge graph. The Harness domain holds the entities of Momentum itself: automations, triggers, issues, conflicts, chats, plans, research and patterns. Wherever the app names an entity, in a card, a chat, an answer or a list, it shows this glyph and colour and opens it on a press.'],
  ['Entity states', states, "Verification is the user's judgement: approval verifies, any rewrite by a run makes the entity unverified again. Sync is the entity against its artifacts and implementation. Contradictions count the open contradiction issues over the entity."],
  ['Automations', automations, 'Twelve automations around the knowledge graph, each with its trigger: schedule, event, the user, the Stop hook or enabling the project. Interview and search start only when the user asks; search answers in one turn and is not a run. Automation runs go one at a time per project; runs the user starts go at once.'],
  ['Triggers', triggers, 'Each automation has a trigger entity in each workspace, holding its schedule, its events and whether it starts on demand. Exploration every two hours, preparation every two hours at half past, validation at 02:00, consistency check at 03:00, retention at 04:00, optimization at 05:00. An approved entity with nothing implementing it starts implementation; a finished implementation starts validation. Summarization runs in the Stop hook of every run and graph build while the project is enabled, so neither has a trigger entity. Scheduled loops and the graph build pause while the feed is at its limit; events still start their runs.'],
  ['Automation management', management, 'Automations are configured through the knowledge base, not through settings. The definition is an entity in the harness workspace, one per automation, with the Claude Code files as its artifacts; the triggers are an entity per automation in each workspace. An edit the user commits lands on the main line as committed. A change optimization proposes passes the consistency guard, lands unverified and takes effect once the user approves it in the feed. Optimization reads every chat and proposes a skill, memory, sub-agent or definition change only for a pattern seen at least three times, as a Harness/Pattern with its evidence; nothing is learnt from one chat, and nothing takes effect before the user approves it. Runs start on demand from the chat and stop from the chat; models and concurrency are settings, and the Settings tab leads to the rest in the knowledge graph.'],
  ['Agent tools', tools, "What a run's agent can call. Claude Code's built-in tools work in the run's own checkout with the project's settings. momentum-kb is an in-process MCP server over the knowledge base: search (full text, semantic, expanded along references), read, references, types, write (validated as it writes) and record_agent_metric. momentum-run carries what the run reports to the harness: the graph build's progress and coverage, and an interview's next question. The summarization sub-agent takes the run's artifacts over through the Agent tool at Stop, and the harness checks it ran before trusting it. Hooks wrap the tools: after every write the consistency guard returns its issues at once; at Stop the run summarizes, fixes what the guard cannot accept and writes its commit message. The momentum MCP server over HTTP is not for runs: it gives the user's voice tools every API handler, ask included, without the UI. A question typed in the explorer search is not a run: the search finds the entities, and the search automation answers from them in one turn without tools, linking each it drew from."],
  ['Summarization', summarization, "When a run stops, its Stop hook hands the artifacts it added, changed or deleted to the summarization sub-agent, which writes one summary entity per piece of work. Artifacts changed by the user's own commits make the entities over them artifact_ahead, and a summarization run rewrites their cards."],
  ['Consistency guard', guard, 'Every write is checked while the run works. When it ends, the transaction passes the guard: card limit, type and references. Everything lands as one commit; what fails carries an issue entity. The consistency check reads the knowledge graph only, never the artifacts, and counts contradictions on each entity.'],
  ['Issue types', issues, 'The kinds of issue the consistency check raises over the knowledge graph. By rule: unresolved references, cards over the character limit, types outside entity-types.tsv or their directory. By reading, in three severities: high for contradiction, logical and ambiguity; medium for design gap, naming and repetition; low for verbose, struct and split. Each finding is its own issue entity, concerning the entity at fault first and the entities it clashes with, repeats or belongs with, with two to four options to resolve it; the check fixes nothing itself.'],
  ['Issue resolution', resolution, "Every issue the consistency check raises offers two to four options to resolve it, each a label and one sentence of what it changes, with the obviously best one recommended when there is one. The feed card shows them with the recommended option picked; a tap picks another. Swipe right resolves with the picked option, swipe left with the user's own resolution: either starts a chat run that applies it to the concerned entities and retires the issue, and the changed entities come back to the feed unverified. Won't resolve keeps the issue, verified, with the reason: the check does not raise it again and it no longer counts as a contradiction."],
  ['Git', git,"One branch per workspace. A run lands as one commit: fast-forwarded when the main line has not moved, replayed onto the new tip otherwise, with a conflict entity over what changed meanwhile. Approval is one more commit. Automation runs queue one at a time; the user's chats run alongside."],
  ['User actions', actions, 'Swipe right approves: one commit, verified; an implementable entity with nothing implementing it starts an implementation run. Swipe left sends back with a comment: a chat run works on the entity. Chat, run on demand, stop a run, manage projects, edit entities and change settings.'],
  ['Settings', settings, 'The Settings tab: theme on this device; included projects, each enabled or disabled, with its knowledge graph build; feed size, the items before loops pause; cards, the character limit and presentation rules; paths never summarized; lifetimes per entity type; concurrent runs in total; models, one for all, per automation or by implementation risk; and links into the knowledge graph, where the automations, entity types, risk rules, triggers and patterns are kept. Values shown are the harness defaults, with models shown by risk.'],
];

async function renderPngs(svgs) {
  // Drawn in Firefox, as everything of the project is looked at; MOMENTUM_BROWSER_CHANNEL=msedge draws it in Edge
  const pw = require('playwright-core');
  const channel = process.env.MOMENTUM_BROWSER_CHANNEL ?? 'moz-firefox';
  const browser = await (channel === 'moz-firefox' ? pw.firefox : pw.chromium).launch({ channel });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const out = [];
    for (const s of svgs) {
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${s}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      out.push(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }));
    }
    return out;
  } finally {
    await browser.close();
  }
}

module.exports = async function renderMechanics(pres, T) {
  const pngs = await renderPngs(SLIDES.map(([, draw]) => draw()));
  if (process.env.MECH_PREVIEW) {
    mkdirSync(process.env.MECH_PREVIEW, { recursive: true });
    pngs.forEach((p, i) => writeFileSync(join(process.env.MECH_PREVIEW, `mech-${i + 1}.png`), p));
  }
  SLIDES.forEach(([title, , notes], i) => {
    const s = pres.addSlide();
    s.addNotes(`${title}. ${notes}`);
    s.background = { color: 'FFFFFF' };
    s.addText(title, {
      shape: pres.shapes.RECTANGLE, x: 0.35, y: 0.3, w: 5.4, h: 0.5, fill: { color: T.hHeader.fill },
      color: 'FFFFFF', fontFace: T.font.head, fontSize: 20, align: 'left', valign: 'middle', margin: [14, 14, 0, 5], isTextBox: true,
    });
    s.addImage({ data: `image/png;base64,${pngs[i].toString('base64')}`, x: 0, y: 0.9, w: 13.333, h: (13.333 * H) / W });
  });
};
