const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const React = require('react');
const RDS = require('react-dom/server');
const fa = require('react-icons/fa6');

const OUT = process.argv[2] || 'harness-diagram.pptx';

// ---------------------------------------------------------------- content
const HARNESS = [
  ['Settings', ['Included projects', 'Feed size', 'Cards', 'Models', 'Links to graph config'], 'FaGear'],
  ['Knowledge Graph Explorer', ['Entity browsing', 'Search by meaning', 'Answers to questions', 'Linked entities'], 'FaDiagramProject'],
  ['Importance Rank', ['Dependencies', 'Stability', 'Performance', 'Priority', 'Velocity'], 'FaRankingStar'],
  ['Chat', ['Question answering', 'Run steering', 'Automation launching'], 'FaComments'],
  ['Metrics', ['Alignment issues', 'Agents usage', 'Sessions duration', 'Consistency'], 'FaChartLine'],
  ['Optimization', ['Patterns across all chats', 'Three repeats at least', 'Skills, memories, agents', 'Approved in the feed'], 'FaWandMagicSparkles'],
  ['Orchestrator', ['Automation deployment', 'Agents deployment', 'Metrics collection'], 'FaSitemap'],
  ['API', ['Front-end entry point', 'Feed polling', 'Session results', 'Approvals'], 'FaPlug'],
  ['Voice Tools', ['Full capability access', 'UI-free control', 'API calls'], 'FaMicrophone'],
  ['RAG', ['Graph retrieval', 'Entity context', 'Chat context', 'Reference traversal'], 'FaMagnifyingGlass'],
];

// ---------------------------------------------------------------- geometry (inches, 13.333 x 7.5)
const CX = 8.9;
const HDR = { y: 0.3, h: 0.5 };
const TITLE_W = 5.4; // every slide's title bar, as in harness-diagram.mechanics.js
// section headings under the title bar, as on the mechanics slides
const SEC = { y: 1.0, h: 0.32 };
const HARN = { x: 0.35, w: 4.25, y: 1.45, bottom: 6.95, gap: 0.1 };
const PROD = { x: 4.8, w: 8.2 };
const BANDS = [
  { key: 'att', y: 1.45, h: 1.8, label: ['Attention', 'Layer'], ly: 2.3 },
  { key: 'kn', y: 3.25, h: 1.2, label: ['Knowledge', 'Layer'], ly: 3.85 },
  { key: 'prod', y: 4.45, h: 2.5, label: ['Product', 'Layer'], ly: 5.45 },
];
const TOP = { w: 1.4, h: 0.46 };
const LOW = { w: 1.3, h: 0.32 };
const ROWS = [4.87, 5.27, 5.67, 6.07, 6.47];

const N = {};
const node = (id, text, cx, cy, sz, layer) => (N[id] = { id, text, cx, cy, w: sz.w, h: sz.h, layer });
node('af', 'Attention Feed', CX, 1.98, TOP, 0);
node('prio', 'Prioritizer', CX - 1.05, 2.78, TOP, 0);
node('ret', 'Retention', CX + 1.05, 2.78, TOP, 0);
node('sc', 'Entity Cards', CX - 2.0, 3.85, TOP, 1);
node('cg', 'Consistency Gate', CX, 3.85, TOP, 1);
node('kg', 'Knowledge Graph', CX + 2.0, 3.85, TOP, 1);
const LEFT = ['Story', 'Plan', 'Change', 'Bug', 'Refactor'];
const RIGHT = ['Exploration', 'Preparation', 'Implementation', 'Testing', 'Review'];
LEFT.forEach((t, i) => node('l' + i, t, CX - 0.95, ROWS[i], LOW, 2));
const BOX_ICONS = {
  l0: 'FaBookOpen', l1: 'FaListCheck', l2: 'FaPenToSquare', l3: 'FaBug', l4: 'FaScrewdriverWrench',
};
RIGHT.forEach((t, i) => node('r' + i, t, CX + 0.95, ROWS[i], LOW, 2));
node('sum', 'Summarizer', CX - 3.2, ROWS[4], LOW, 2);
node('trg', 'Triggers', CX + 3.2, ROWS[4], LOW, 2);
const ME = { cx: CX, headY: 0.08, headD: 0.24, bodyY: 0.35, bodyW: 0.56, bodyH: 0.47 };

const STRAIGHT = [
  ['prio', 'af'], ['af', 'ret'], ['sc', 'prio'], ['sc', 'cg', 'both'], ['cg', 'kg', 'both'],
  ['ret', 'kg'], ['kg', 'trg'], ['sum', 'sc'],
];
// ---------------------------------------------------------------- helpers
const anchor = (b, px, py) => {
  const dx = px - b.cx, dy = py - b.cy;
  const t = Math.min(dx ? (b.w / 2) / Math.abs(dx) : Infinity, dy ? (b.h / 2) / Math.abs(dy) : Infinity);
  return [b.cx + dx * t, b.cy + dy * t];
};
const left = (b) => [b.cx - b.w / 2, b.cy];
const right = (b) => [b.cx + b.w / 2, b.cy];

// text width in inches, measured from the installed font when available
const FONT_FILES = { Calibri: 'C:/Windows/Fonts/calibri.ttf' };
const fontCache = {};
function textWidth(text, face, size) {
  if (!(face in fontCache)) {
    try {
      const opentype = require('opentype.js');
      const buf = require('fs').readFileSync(FONT_FILES[face]);
      fontCache[face] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    } catch { fontCache[face] = null; }
  }
  const f = fontCache[face];
  return f ? f.getAdvanceWidth(text, size) / 72 : text.length * size * 0.5 / 72;
}

async function iconData(name, color) {
  const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { color: '#' + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
async function svgData(svg) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// ---------------------------------------------------------------- renderer
async function render(pres, T) {
  const s = pres.addSlide();
  s.addNotes(`Style: ${T.name}`);
  if (T.bgImage) s.background = { data: await T.bgImage() };
  else s.background = { color: T.bg };

  const shp = (r) => (r ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE);
  const shadow = (sh) => (sh ? { type: 'outer', blur: sh.blur ?? 6, offset: sh.offset ?? 2, angle: 90, color: sh.color ?? '000000', opacity: sh.opacity ?? 0.15 } : undefined);
  const lineOf = (l) => (l ? { color: l.color, width: l.width ?? 0.75, dashType: l.dash, transparency: l.transparency } : { type: 'none' });
  const fillOf = (f, tr) => (f ? { color: f, transparency: tr } : { type: 'none' });
  const bodyFont = T.font.body, headFont = T.font.head;

  // title bar, then the two section headings
  const H = T.hHeader;
  s.addText(pres.title, {
    shape: pres.shapes.RECTANGLE, x: HARN.x, y: HDR.y, w: TITLE_W, h: HDR.h, fill: { color: H.fill },
    color: H.color, fontFace: headFont, fontSize: H.size ?? 20, align: 'left', valign: 'middle', margin: [14, 14, 0, 5], isTextBox: true,
  });
  for (const [x, text] of [[HARN.x, 'Harness'], [PROD.x, 'Products']]) {
    s.addText(text, { x, y: SEC.y, w: 3, h: SEC.h, color: T.section.color, fontFace: headFont, fontSize: T.section.size, bold: true, valign: 'middle', margin: 0, isTextBox: true });
  }

  // harness cards
  const C = T.card;
  const cw = (HARN.w - 0.15) / 2;
  const ch = (HARN.bottom - HARN.y - HARN.gap * 4) / 5;
  for (let i = 0; i < HARNESS.length; i++) {
    const [title, items, icon] = HARNESS[i];
    const x = HARN.x + (i % 2) * (cw + 0.15);
    const y = HARN.y + Math.floor(i / 2) * (ch + HARN.gap);
    s.addShape(shp(C.radius), {
      x, y, w: cw, h: ch, rectRadius: C.radius,
      fill: fillOf(C.fill, C.transparency), line: lineOf(C.line), shadow: shadow(C.shadow),
    });
    const iconW = T.icons ? 0.3 : 0;
    const runs = [{ text: title, options: { bold: true, color: C.titleColor, fontFace: headFont, fontSize: C.titleSize ?? 10, breakLine: true, paraSpaceAfter: 2 } }];
    items.forEach((it, k) => runs.push({ text: it, options: { color: C.itemColor, fontFace: bodyFont, fontSize: C.itemSize ?? 9, breakLine: k < items.length - 1 } }));
    s.addText(runs, { x, y, w: cw - iconW - (iconW ? 0.08 : 0), h: ch, valign: 'top', margin: [8, 6, 4, 3], isTextBox: true });
    if (T.icons) {
      const d = 0.3, ix = x + cw - d - 0.08, iy = y + 0.08;
      s.addShape(pres.shapes.OVAL, { x: ix, y: iy, w: d, h: d, fill: fillOf(T.icons.fill, T.icons.transparency), line: { type: 'none' } });
      s.addImage({ data: await iconData(icon, T.icons.color), x: ix + 0.075, y: iy + 0.075, w: 0.15, h: 0.15 });
    }
  }

  // bands
  BANDS.forEach((b, i) => {
    const B = T.bands[i];
    const g = T.bandGap ?? 0;
    const y = b.y + (i > 0 ? g / 2 : 0), h = b.h - (i > 0 ? g / 2 : 0) - (i < 2 ? g / 2 : 0);
    s.addShape(shp(T.bandRadius), {
      x: PROD.x, y, w: PROD.w, h, rectRadius: T.bandRadius,
      fill: fillOf(B.fill, B.transparency), line: lineOf(B.line),
    });
    const L = T.label;
    if (L && L.pill) {
      s.addText(b.label.join(' '), {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.13, x: 11.85, y: b.ly - 0.14, w: 1.0, h: 0.28,
        fill: { color: B.labelFill }, line: { type: 'none' }, color: B.labelColor, fontFace: bodyFont, fontSize: 8.5, bold: true,
        align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
    } else {
      s.addText([
        { text: b.label[0], options: { breakLine: true } }, { text: b.label[1] },
      ], {
        x: 11.9, y: b.ly - 0.25, w: 1.0, h: 0.5, color: B.labelColor, fontFace: L?.font ?? bodyFont,
        fontSize: L?.size ?? 11, bold: L?.bold, italic: L?.italic, charSpacing: L?.charSpacing, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
    }
  });

  // consistency border
  const af = N.af;
  s.addShape(pres.shapes.LINE, { x: CX, y: af.cy + af.h / 2, w: 0, h: 6.95 - (af.cy + af.h / 2), line: { color: T.border.color, width: T.border.width ?? 1, dashType: T.border.dash ?? 'dash' } });
  if (T.sides) {
    // left of the border is unverified, right is verified — shown at the top of the attention layer
    const side = (S, iconX, textX, align) => Promise.all([
      iconData(S.icon, S.color).then((data) => s.addImage({ data, x: iconX, y: 1.6, w: 0.2, h: 0.2 })),
      s.addText(S.text, { x: textX, y: 1.55, w: 1.1, h: 0.3, color: S.color, fontFace: headFont, fontSize: 12, bold: true, align, valign: 'middle', margin: 0, isTextBox: true }),
    ]);
    await side(T.sides.unverified, CX - 2.35, CX - 2.08, 'left');
    await side(T.sides.verified, CX + 1.24, CX + 1.51, 'left');
  }
  s.addText('Consistency border', { x: CX - 0.85, y: 7.0, w: 1.7, h: 0.3, color: T.border.labelColor ?? T.border.color, fontFace: bodyFont, fontSize: 10, italic: T.border.italic, align: 'center', valign: 'middle', margin: 0, isTextBox: true });

  // edges
  const E = T.edge;
  const eline = (both) => ({ color: E.color, width: E.width ?? 1, beginArrowType: both ? (E.arrow ?? 'triangle') : undefined, endArrowType: E.arrow ?? 'triangle', transparency: E.transparency });
  const straight = ([x1, y1], [x2, y2], both) => s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1, line: eline(both),
  });
  const curve = ([x1, y1], [x2, y2]) => {
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const k = 0.55, dx = x2 - x1;
    s.addShape(pres.shapes.CUSTOM_GEOMETRY, {
      x, y, w: Math.abs(dx), h: Math.abs(y2 - y1), fill: { type: 'none' }, line: eline(),
      points: [
        { x: x1 - x, y: y1 - y },
        { x: x2 - x, y: y2 - y, curve: { type: 'cubic', x1: x1 - x + dx * k, y1: y1 - y, x2: x2 - x - dx * k, y2: y2 - y } },
      ],
    });
  };
  straight([ME.cx, ME.bodyY + ME.bodyH], [CX, af.cy - af.h / 2]);
  for (const [a, b, dir] of STRAIGHT) {
    const A = N[a], B = N[b];
    straight(anchor(A, B.cx, B.cy), anchor(B, A.cx, A.cy), dir === 'both');
  }
  for (let i = 0; i < 5; i++) straight(left(N['r' + i]), right(N['l' + i]));
  for (let i = 0; i < 4; i++) {
    curve(left(N.trg), right(N['r' + i]));
    curve(left(N['l' + i]), right(N.sum));
  }
  straight(left(N.trg), right(N.r4));
  straight(left(N.l4), right(N.sum));

  // boxes
  for (const b of Object.values(N)) {
    const X = { ...T.box, ...(T.boxByLayer ? T.boxByLayer[b.layer] : {}) };
    const top = b.layer < 2 && !['sum', 'trg'].includes(b.id);
    const radius = X.pill ? b.h / 2 : X.radius;
    const fontFace = X.font ?? bodyFont, fontSize = top ? (X.size ?? 10.5) : (X.sizeLow ?? 10);
    const box = {
      shape: shp(radius), rectRadius: radius, x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h,
      fill: fillOf(X.fill, X.transparency), line: lineOf(X.line), shadow: shadow(X.shadow),
    };
    const txt = { color: X.color, fontFace, fontSize, bold: X.bold, valign: 'middle', margin: 0, isTextBox: true };
    if (!BOX_ICONS[b.id]) {
      s.addText(b.text, { ...box, ...txt, align: 'center' });
      continue;
    }
    // icon + text centred together as one group
    const d = 0.17, gap = 0.07, tw = textWidth(b.text, fontFace, fontSize);
    const x0 = b.cx - (d + gap + tw) / 2;
    s.addShape(box.shape, box);
    s.addImage({ data: await iconData(BOX_ICONS[b.id], X.color), x: x0, y: b.cy - d / 2, w: d, h: d });
    s.addText(b.text, { ...txt, x: x0 + d + gap, y: b.cy - b.h / 2, w: tw + 0.15, h: b.h, align: 'left' });
  }

  // more automations: vertical ellipsis under the last box of each column
  for (const b of [N.l4, N.r4]) {
    const d = 0.03, step = 0.05, y0 = b.cy + b.h / 2 + 0.07;
    for (let k = 0; k < 3; k++) {
      s.addShape(pres.shapes.OVAL, { x: b.cx - d / 2, y: y0 + k * step, w: d, h: d, fill: { color: E.color }, line: { type: 'none' } });
    }
  }

  // me
  const M = T.me;
  s.addShape(pres.shapes.OVAL, { x: ME.cx - ME.headD / 2, y: ME.headY, w: ME.headD, h: ME.headD, fill: fillOf(M.fill), line: lineOf(M.line) });
  s.addText('User', {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.16, x: ME.cx - ME.bodyW / 2, y: ME.bodyY, w: ME.bodyW, h: ME.bodyH,
    fill: fillOf(M.fill), line: lineOf(M.line), shadow: shadow(M.shadow), color: M.color, fontFace: headFont, fontSize: 11, bold: M.bold,
    align: 'center', valign: 'middle', margin: 0, isTextBox: true,
  });
}

// ---------------------------------------------------------------- mobile app slide
// example cards: momentum's own work
const CARDS = [
  {
    type: 'PLAN', project: 'momentum', title: 'Consistency guard on every change',
    desc: 'Reacts to every change in the knowledge base so it stays consistent at all times, despite free access.',
    bullets: ['Groups related changes into a transaction', 'Validates card limits and references', 'Raises what it cannot fix as an issue', 'Updates the index and metrics database'],
    diagram: { boxes: [['Run', 0, 0], ['Guard', 1, 0], ['Main line', 2, 0], ['Issue', 1, 1]], arrows: [[0, 1], [1, 2], [1, 3]] },
  },
  {
    type: 'CHANGE', project: 'momentum', title: 'Remote access over a private mesh',
    desc: 'No port is exposed to the public internet; clients reach the machine through a WireGuard mesh.',
    bullets: ['API listens only on the mesh', 'One key per enrolled device', 'Lost devices revoked centrally', 'No shared secret in clients'],
    table: [['Layer', 'Protection'], ['Tunnel', 'End-to-end encryption'], ['API', 'Per-user session'], ['Edge', 'No inbound firewall rule']],
  },
  {
    type: 'STORY', project: 'momentum', title: 'Attention feed ranking',
    desc: 'Ranks what should be done right now so the product ends up the best it can be.',
    bullets: ['One feed across enabled projects', 'Items are entities of any type', 'No project priority', 'Read straight from the index'],
    table: [['Parameter', 'Measures'], ['Product', 'Impact on the product'], ['Timeline', 'Impact on the timeline'], ['Unlocks', 'How much it unlocks']],
    comment: 'Rank by the Importance Rank instead: dependencies, stability, performance, priority and velocity.',
  },
];
const TABS = [
  ['Feed', 'FaLayerGroup'], ['Explorer', 'FaDiagramProject'], ['Chat', 'FaComments'],
  ['Timeline', 'FaClockRotateLeft'], ['Metrics', 'FaChartLine'], ['Settings', 'FaGear'],
];
const PHONE = { w: 2.72, h: 5.9, y: 1.05, bez: 0.1, r: 0.36 };
const STAMP_Y = 2.87; // stamp centre, from the card top

async function renderApp(pres, T) {
  const s = pres.addSlide();
  s.addNotes(`Style: ${T.name} — mobile app`);
  s.background = { color: T.bg };
  const head = T.font.head, body = T.font.body;
  const INK = '2F3E46', MUTED = '52606A', ACCENT = 'B85042', OK = '3F6B52', NO = 'A0402F';
  const SCREEN = 'F7F5F0', LINE = 'D5D9D3';
  const shade = (o = {}) => ({ type: 'outer', blur: 6, offset: 2, angle: 90, color: '1E293B', opacity: 0.16, ...o });

  s.addText('Mobile App', {
    shape: pres.shapes.RECTANGLE, x: 0.35, y: HDR.y, w: TITLE_W, h: HDR.h, fill: { color: T.hHeader.fill },
    color: 'FFFFFF', fontFace: head, fontSize: 20, align: 'left', valign: 'middle', margin: [14, 14, 0, 5], isTextBox: true,
  });

  const icon = async (name, color, x, y, d) => s.addImage({ data: await iconData(name, color), x, y, w: d, h: d });
  // rotate (dx, dy) clockwise by deg, slide coordinates (y down)
  const rot = (dx, dy, deg) => {
    const a = (deg * Math.PI) / 180;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  };

  // card-local layout (inches from the card's top-left), rotated with the card
  const CL = { m: 0.14, text: 2.6, extra: 3.2 };
  const card = (c, cx, cy, w, h, deg = 0, stamp) => {
    const r = (deg + 360) % 360;
    const at = (lx, ly, ew, eh) => {
      const [dx, dy] = rot(lx + ew / 2 - w / 2, ly + eh / 2 - h / 2, deg);
      return { x: cx + dx - ew / 2, y: cy + dy - eh / 2, w: ew, h: eh, rotate: r };
    };
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { ...at(0, 0, w, h), rectRadius: 0.12, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 0.75 }, shadow: shade() });

    const iw = w - 2 * CL.m;
    const runs = [
      { text: `${c.type}  ·  ${c.project}`, options: { fontFace: body, fontSize: 8, bold: true, color: ACCENT, charSpacing: 1, breakLine: true } },
      { text: c.title, options: { fontFace: head, fontSize: 15, bold: true, color: INK, breakLine: true, paraSpaceBefore: 6 } },
      { text: c.desc, options: { fontFace: body, fontSize: 9.5, color: MUTED, breakLine: true, paraSpaceBefore: 6 } },
    ];
    c.bullets.forEach((b, k) => runs.push({
      text: b, options: { fontFace: body, fontSize: 9.5, color: INK, bullet: { indent: 10 }, paraSpaceBefore: k ? 3 : 8, breakLine: k < c.bullets.length - 1 },
    }));
    s.addText(runs, { ...at(CL.m, CL.m, iw, CL.text - CL.m), valign: 'top', margin: 0, isTextBox: true });

    if (c.table) {
      const c0 = 0.72, rh = 0.3;
      c.table.forEach((row, i) => row.forEach((cell, j) => s.addText(cell, {
        shape: pres.shapes.RECTANGLE, ...at(CL.m + (j ? c0 : 0), CL.extra + i * rh, j ? iw - c0 : c0, rh),
        fill: { color: i ? 'FFFFFF' : 'EEF1EC' }, line: { color: LINE, width: 0.75 },
        fontFace: body, fontSize: 8.5, bold: !i, color: i ? INK : MUTED, valign: 'middle', margin: [0, 5, 0, 5], isTextBox: true,
      })));
    }
    if (c.diagram) {
      const bw = 0.58, bh = 0.4, gx = (iw - 3 * bw) / 2, gy = 0.34;
      const box = ([, col, row]) => ({ lx: CL.m + col * (bw + gx), ly: CL.extra + 0.05 + row * (bh + gy) });
      c.diagram.arrows.forEach(([i, j]) => {
        const A = box(c.diagram.boxes[i]), B = box(c.diagram.boxes[j]);
        const horiz = A.ly === B.ly;
        const x1 = horiz ? A.lx + bw : A.lx + bw / 2, y1 = horiz ? A.ly + bh / 2 : A.ly + bh;
        const len = horiz ? B.lx - x1 : B.ly - y1;
        s.addShape(pres.shapes.LINE, { ...at(x1, y1, horiz ? len : 0, horiz ? 0 : len), line: { color: INK, width: 1, endArrowType: 'triangle' } });
      });
      c.diagram.boxes.forEach((bx) => {
        const { lx, ly } = box(bx);
        s.addText(bx[0], {
          shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, ...at(lx, ly, bw, bh), fill: { color: 'FFFFFF' }, line: { color: INK, width: 1 },
          fontFace: body, fontSize: 8.5, color: INK, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
        });
      });
    }

    if (stamp) {
      const sw = 1.1, sh = 0.32;
      s.addText(stamp.text, {
        shape: pres.shapes.ROUNDED_RECTANGLE, ...at(stamp.lx - sw / 2, STAMP_Y - sh / 2, sw, sh), rotate: (deg + stamp.tilt + 360) % 360, rectRadius: 0.06,
        fill: { color: 'FFFFFF' }, line: { color: stamp.color, width: 2 }, color: stamp.color,
        fontFace: body, fontSize: 10, bold: true, charSpacing: 1.5, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
    }
    return at;
  };

  const phone = async (x, state, c, caption) => {
    const { w: W, h: H, y, bez: b } = PHONE;
    const sx = x + b, sw = W - 2 * b, mid = x + W / 2;
    const wash = state === 'approve' ? 'DCE7DF' : state === 'reject' ? 'F4DCD6' : null;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: W, h: H, rectRadius: PHONE.r, fill: { color: SCREEN }, line: { type: 'none' }, shadow: shade({ blur: 12, offset: 4, opacity: 0.22 }) });

    // card area
    // everything between the notch and the tab bar
    const top = y + 0.36, ty = y + H - 0.72;
    const cw = sw - 0.16, ch = ty - 0.08 - top, cy = top + ch / 2;
    if (wash) s.addShape(pres.shapes.RECTANGLE, { x: sx, y: y + b, w: sw, h: ty - y - b, fill: { color: wash }, line: { type: 'none' } });
    const dir = state === 'approve' ? 1 : state === 'reject' ? -1 : 0;
    const at = dir
      ? card(c, mid + dir * 0.04, cy, cw, ch, dir * 2.5, { text: dir > 0 ? 'APPROVE' : 'DISAPPROVE', color: dir > 0 ? OK : NO, lx: dir > 0 ? 0.7 : cw - 0.7, tilt: dir * -10 })
      : card(c, mid, cy, cw, ch);

    // swipe gesture, beside the stamp and clear of the comment sheet
    if (dir) {
      const len = 0.62, lx = dir > 0 ? cw / 2 + 0.2 : cw / 2 - 0.2 - len;
      const { x: gx, y: gy } = at(lx, STAMP_Y - 0.12, len, 0);
      s.addShape(pres.shapes.LINE, { x: gx, y: gy, w: len, h: 0, flipH: dir < 0, line: { color: INK, width: 2, endArrowType: 'triangle', transparency: 15 } });
      const tip = dir > 0 ? gx + len : gx;
      await icon('FaHandPointer', INK, tip - 0.12 + dir * 0.04, gy + 0.05, 0.26);
    }

    // tab bar, over the card
    s.addShape(pres.shapes.RECTANGLE, { x: sx, y: ty, w: sw, h: y + H - b - ty, fill: { color: SCREEN }, line: { type: 'none' } });
    s.addShape(pres.shapes.LINE, { x: sx, y: ty, w: sw, h: 0, line: { color: LINE, width: 0.75 } });
    const tw = sw / TABS.length;
    for (let i = 0; i < TABS.length; i++) {
      const [label, ic] = TABS[i];
      const color = i === 0 ? ACCENT : MUTED, tx = sx + i * tw;
      await icon(ic, color, tx + tw / 2 - 0.1, ty + 0.1, 0.2);
      s.addText(label, { x: tx, y: ty + 0.32, w: tw, h: 0.18, fontFace: body, fontSize: 7, bold: i === 0, color, align: 'center', margin: 0, isTextBox: true });
    }

    // comment sheet
    if (state === 'reject') {
      const shy = y + 3.66;
      s.addShape(pres.shapes.RECTANGLE, { x: sx, y: y + 0.1, w: sw, h: shy - y - 0.1, fill: { color: '1E293B', transparency: 82 }, line: { type: 'none' } });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: sx, y: shy, w: sw, h: y + H - shy - 0.02, rectRadius: 0.26, fill: { color: 'FFFFFF' }, line: { type: 'none' },
        shadow: { type: 'outer', blur: 10, offset: 3, angle: 270, color: '1E293B', opacity: 0.2 },
      });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mid - 0.3, y: shy + 0.1, w: 0.6, h: 0.05, rectRadius: 0.025, fill: { color: LINE }, line: { type: 'none' } });
      s.addText('Disapprove', { x: sx + 0.18, y: shy + 0.22, w: sw - 0.36, h: 0.46, fontFace: head, fontSize: 13, bold: true, color: INK, valign: 'middle', margin: 0, isTextBox: true });
      s.addText(c.comment, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: sx + 0.18, y: shy + 0.74, w: sw - 0.36, h: 0.62,
        fill: { color: SCREEN }, line: { color: ACCENT, width: 1 }, fontFace: body, fontSize: 9, color: INK, valign: 'top', margin: [8, 8, 8, 8], isTextBox: true,
      });
      const bw = (sw - 0.36 - 0.12) / 2, bY = shy + 1.48;
      s.addText('Cancel', {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.19, x: sx + 0.18, y: bY, w: bw, h: 0.38, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 },
        fontFace: body, fontSize: 10, color: INK, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
      s.addText('Send back', {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.19, x: sx + 0.3 + bw, y: bY, w: bw, h: 0.38, fill: { color: ACCENT }, line: { type: 'none' },
        fontFace: body, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
    }

    // frame on top so nothing spills past the screen edge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + b / 2, y: y + b / 2, w: W - b, h: H - b, rectRadius: PHONE.r - b / 2, fill: { type: 'none' }, line: { color: INK, width: b * 72 } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mid - 0.38, y: y + 0.14, w: 0.76, h: 0.14, rectRadius: 0.07, fill: { color: INK }, line: { type: 'none' } });

    s.addText(caption, { x: x - 0.4, y: 7.0, w: W + 0.8, h: 0.3, color: ACCENT, fontFace: body, fontSize: 10, italic: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  };

  const gap = (13.333 - 3 * PHONE.w) / 4;
  await phone(gap, 'feed', CARDS[0], 'Entity cards');
  await phone(gap * 2 + PHONE.w, 'approve', CARDS[1], 'Swipe right to approve');
  await phone(gap * 3 + PHONE.w * 2, 'reject', CARDS[2], 'Swipe left to disapprove with a comment');
}

// ---------------------------------------------------------------- themes
const soft = (o = {}) => ({ blur: 8, offset: 2, opacity: 0.12, color: '1E293B', ...o });

const THEME = {
  name: 'Terracotta Editorial',
  bg: 'FFFFFF', font: { head: 'Cambria', body: 'Calibri' },
  hHeader: { fill: '2F3E46', color: 'FFFFFF', size: 20, align: 'left' },
  section: { color: '2F3E46', size: 15 },
  // the mechanics slides' look: rounded paper cards, layer-coloured pills on rounded washes, soft shadows
  card: { fill: 'EEF1EC', radius: 0.15, titleColor: '2F3E46', itemColor: '52606A', titleSize: 10 },
  icons: { fill: 'FFFFFF', color: '2F3E46' },
  bandRadius: 0.15, bandGap: 0.1,
  bands: [
    { fill: 'F4DCD6', labelColor: 'A0402F', labelFill: 'FFFFFF' },
    { fill: 'EFE8D2', labelColor: '7C6224', labelFill: 'FFFFFF' },
    { fill: 'DCE7DF', labelColor: '3F6B52', labelFill: 'FFFFFF' },
  ],
  label: { pill: true },
  box: { fill: 'FFFFFF', pill: true, bold: true, color: '2F3E46', shadow: soft() },
  boxByLayer: [
    { line: { color: 'A0402F', width: 1.5 } },
    { line: { color: '7C6224', width: 1.5 } },
    { line: { color: '3F6B52', width: 1.5 } },
  ],
  edge: { color: '52606A', width: 1.75 },
  border: { color: 'A0402F', width: 1.5, italic: true },
  sides: {
    unverified: { text: 'Unverified', color: '8A6D2B', icon: 'FaCircleQuestion' },
    verified: { text: 'Verified', color: '3F6B52', icon: 'FaCircleCheck' },
  },
  me: { fill: '2F3E46', color: 'FFFFFF' },
};

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = 'Harness & Products';
  await render(pres, THEME);
  await renderApp(pres, THEME);
  // How everything works together: entities, states, automations, summarization, the gate, git, user actions
  await require('./harness-diagram.mechanics.js')(pres, THEME);
  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT);
})();
