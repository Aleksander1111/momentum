// Mechanics slides: how everything works together. Required by harness-diagram.build.js, same theme and palette.
// Every slide is drawn from the same few helpers: a header, boxes, pills, arrows and notes; bullets are noun phrases.

const INK = '2F3E46', MUTED = '52606A', ACCENT = 'B85042', OK = '3F6B52', LINE = 'D5D9D3', PAPER = 'EEF1EC';
const WASH = { att: 'F4DCD6', kn: 'EFE8D2', prod: 'DCE7DF' };
const STATE = { unverified: '8A6D2B', verified: '3F6B52', synced: '3F6B52', entity_ahead: '7C6224', artifact_ahead: 'A0402F', updating: '52606A' };
const HDR = { y: 0.3, h: 0.5 };

module.exports = async function renderMechanics(pres, T, { iconData, textWidth }) {
  const head = T.font.head, body = T.font.body;
  // A fresh object per shape: pptxgenjs rewrites the shadow it is given, so a shared one breaks the file for PowerPoint
  const shade = () => ({ type: 'outer', blur: 3, offset: 1.5, angle: 90, color: '1E293B', opacity: 0.18 });

  // ---------------------------------------------------------------- helpers, bound to one slide
  function tools(s) {
    const header = (text, w = 5.4) => s.addText(text, {
      shape: pres.shapes.RECTANGLE, x: 0.35, y: HDR.y, w, h: HDR.h, fill: { color: T.hHeader.fill },
      color: 'FFFFFF', fontFace: head, fontSize: 20, align: 'left', valign: 'middle', margin: [14, 14, 0, 5], isTextBox: true,
    });
    const sub = (text) => s.addText(text, {
      x: 0.35, y: HDR.y + HDR.h + 0.05, w: 12.6, h: 0.32, color: MUTED, fontFace: head, fontSize: 12, italic: true, margin: 0, isTextBox: true,
    });
    const lineOf = (c = INK, w = 0.75, dash) => ({ color: c, width: w, dashType: dash });
    // A box with a bold title and noun-phrase lines beneath it
    const box = (x, y, w, h, title, lines = [], o = {}) => {
      const runs = [{ text: title, options: { bold: true, color: o.titleColor ?? INK, fontFace: head, fontSize: o.titleSize ?? 11, breakLine: lines.length > 0, paraSpaceAfter: 3 } }];
      lines.forEach((t, k) => runs.push({ text: t, options: { color: o.color ?? MUTED, fontFace: body, fontSize: o.size ?? 8.5, breakLine: k < lines.length - 1, ...(o.bullets ? { bullet: { indent: 8 } } : {}) } }));
      s.addText(runs, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w, h, fill: { color: o.fill ?? 'FFFFFF' },
        line: lineOf(o.line ?? INK, o.lineWidth ?? 0.75, o.dash), shadow: o.flat ? undefined : shade(),
        valign: o.valign ?? 'top', align: o.align ?? 'left', margin: [7, 8, 5, 8], isTextBox: true,
      });
      return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
    };
    const pill = (cx, cy, text, color, o = {}) => {
      const w = o.w ?? Math.max(1.0, textWidth(text, body, 10) + 0.4), h = o.h ?? 0.34;
      s.addText(text, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: h / 2, x: cx - w / 2, y: cy - h / 2, w, h,
        fill: { color: o.fill ?? 'FFFFFF' }, line: lineOf(color, 1.5), color, fontFace: body, fontSize: 10, bold: true,
        align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
      return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
    };
    const tag = (x, y, text, color) => {
      const w = textWidth(text, body, 7.5) + 0.22, h = 0.22;
      s.addText(text, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: h / 2, x, y, w, h, fill: { color }, line: { type: 'none' },
        color: 'FFFFFF', fontFace: body, fontSize: 7.5, bold: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
      });
      return w;
    };
    const note = (x, y, w, text, o = {}) => s.addText(text, {
      x, y, w, h: o.h ?? 0.3, color: o.color ?? MUTED, fontFace: body, fontSize: o.size ?? 9, italic: o.italic ?? true,
      align: o.align ?? 'left', valign: 'top', margin: 0, isTextBox: true,
    });
    const arrow = (x1, y1, x2, y2, o = {}) => s.addShape(pres.shapes.LINE, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1,
      line: { color: o.color ?? INK, width: o.width ?? 1, dashType: o.dash, endArrowType: o.noHead ? undefined : 'triangle', beginArrowType: o.both ? 'triangle' : undefined },
    });
    // Edge from the border of one box to the border of another, with an optional label at its middle
    const anchor = (b, px, py) => {
      const dx = px - b.cx, dy = py - b.cy;
      const t = Math.min(dx ? (b.w / 2) / Math.abs(dx) : Infinity, dy ? (b.h / 2) / Math.abs(dy) : Infinity);
      return [b.cx + dx * t, b.cy + dy * t];
    };
    const edge = (a, b, label, o = {}) => {
      const [x1, y1] = anchor(a, b.cx, b.cy), [x2, y2] = anchor(b, a.cx, a.cy);
      arrow(x1, y1, x2, y2, o);
      if (label) {
        const w = textWidth(label, body, 8) + 0.2, h = 0.24;
        s.addText(label, {
          x: (x1 + x2) / 2 - w / 2 + (o.dx ?? 0), y: (y1 + y2) / 2 - h / 2 + (o.dy ?? 0), w, h, fill: { color: T.bg }, line: { type: 'none' },
          color: o.labelColor ?? INK, fontFace: body, fontSize: 8, italic: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
        });
      }
    };
    const icon = async (name, color, x, y, d = 0.22) => s.addImage({ data: await iconData(name, color), x, y, w: d, h: d });
    const band = (x, y, w, h, fill, label, labelColor) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { type: 'none' } });
      if (label) s.addText(label, { x: x + 0.15, y: y + 0.06, w: w - 0.3, h: 0.28, color: labelColor ?? INK, fontFace: head, fontSize: 11, italic: true, margin: 0, isTextBox: true });
    };
    return { header, sub, box, pill, tag, note, arrow, edge, icon, band };
  }

  const blocks = [];
  const slide = (name) => {
    const s = pres.addSlide();
    s.addNotes(`Style: ${T.name} — ${name}`);
    s.background = { color: T.bg };
    return s;
  };

  // ---------------------------------------------------------------- 1. the loop
  blocks.push(async () => {
    const s = slide('how everything works together');
    const t = tools(s);
    t.header('How everything works together');
    t.sub('One loop per project: triggers start runs, runs leave entities and artifacts, everything lands on the main line, the user verifies it in the feed');
    const W = 2.4, H = 1.35, top = 1.55, bottom = 4.55, xs = [0.45, 3.8, 7.15, 10.5];
    const b1 = t.box(xs[0], top, W, H, 'Triggers', ['Trigger entities per workspace', 'Schedule, event or on demand', 'Feed size as the bound'], { fill: WASH.prod });
    const b2 = t.box(xs[1], top, W, H, 'Runs', ['One Claude Code process per run', 'Own detached checkout of the main line', 'Automation runs one at a time per project'], { fill: WASH.prod });
    const b3 = t.box(xs[2], top, W, H, 'Work in the checkout', ['Entities as cards', 'Artifacts: code, plans, chats', 'Free read and write, nothing gated'], { fill: WASH.prod });
    const b4 = t.box(xs[3], top, W, H, 'Summarization', ['Stop hook before the run ends', 'One summary entity per artifact group', 'Card within the character limit'], { fill: WASH.kn });
    const b8 = t.box(xs[0], bottom, W, H, 'User actions', ['Approve or send back', 'Chat, run on demand, stop', 'Edit entities directly'], { fill: WASH.att });
    const b7 = t.box(xs[1], bottom, W, H, 'Index and feed', ['Index follows the main line', 'Unverified entities in the feed', 'Ranking: product, timeline, unlocks'], { fill: WASH.att });
    const b6 = t.box(xs[2], bottom, W, H, 'Main line', ['One branch, one commit per run', 'Verification as a state, not a place', 'Approval as one more commit'], { fill: WASH.kn });
    const b5 = t.box(xs[3], bottom, W, H, 'Consistency gate', ['Card limit, types, references', 'Issue entity for what cannot pass', 'Landing: fast-forward or replay'], { fill: WASH.kn });
    t.edge(b1, b2, 'run queued');
    t.edge(b2, b3, 'writes');
    t.edge(b3, b4, 'artifacts');
    t.edge(b4, b5, 'transaction');
    t.edge(b5, b6, 'landed');
    t.edge(b6, b7, 'indexed');
    t.edge(b7, b8, 'ranked feed');
    t.edge(b8, b1, 'approval, entity_ahead, send back');
    t.note(0.6, 6.25, 12.1, 'Runs the user starts go at once, alongside the queued automation runs. A plan is an ordinary entity on this loop: approved and ahead of its artifacts.', { align: 'center' });
  });

  // ---------------------------------------------------------------- 2. entities
  blocks.push(async () => {
    const s = slide('entities');
    const t = tools(s);
    t.header('Entities');
    t.sub('The unit of the knowledge base: standalone, typed, written as its card; a summary is an entity with artifacts beneath it');
    // the card
    const cx = 0.6, cy = 1.4, cw = 4.4, ch = 4.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.12, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 0.75 }, shadow: shade() });
    s.addText([
      { text: 'GOVERNANCE / DECISION  ·  momentum', options: { fontFace: body, fontSize: 8, bold: true, color: ACCENT, charSpacing: 1, breakLine: true } },
      { text: 'Remote access over a private mesh', options: { fontFace: head, fontSize: 15, bold: true, color: INK, breakLine: true, paraSpaceBefore: 6 } },
      { text: 'No port is exposed to the public internet; clients reach the machine through a WireGuard mesh.', options: { fontFace: body, fontSize: 9.5, color: MUTED, breakLine: true, paraSpaceBefore: 6 } },
      { text: 'API on the mesh interface only', options: { fontFace: body, fontSize: 9.5, color: INK, bullet: { indent: 10 }, paraSpaceBefore: 8, breakLine: true } },
      { text: 'One key per enrolled device', options: { fontFace: body, fontSize: 9.5, color: INK, bullet: { indent: 10 }, paraSpaceBefore: 3, breakLine: true } },
      { text: 'Per-user session on top of the tunnel', options: { fontFace: body, fontSize: 9.5, color: INK, bullet: { indent: 10 }, paraSpaceBefore: 3 } },
    ], { x: cx + 0.15, y: cy + 0.12, w: cw - 0.3, h: 2.4, valign: 'top', margin: 0, isTextBox: true });
    const rows = [['Layer', 'Protection'], ['Tunnel', 'End-to-end encryption'], ['API', 'Per-user session'], ['Edge', 'No inbound firewall rule']];
    rows.forEach((row, i) => row.forEach((cell, j) => s.addText(cell, {
      shape: pres.shapes.RECTANGLE, x: cx + 0.15 + (j ? 0.9 : 0), y: cy + 2.6 + i * 0.28, w: j ? cw - 0.3 - 0.9 : 0.9, h: 0.28,
      fill: { color: i ? 'FFFFFF' : PAPER }, line: { color: LINE, width: 0.75 }, fontFace: body, fontSize: 8.5, bold: !i, color: i ? INK : MUTED, valign: 'middle', margin: [0, 5, 0, 5], isTextBox: true,
    })));
    await t.icon('FaCircleQuestion', STATE.unverified, cx + cw - 0.75, cy + 0.14, 0.2);
    await t.icon('FaLink', STATE.synced, cx + cw - 0.45, cy + 0.14, 0.2);
    t.note(cx, cy + ch + 0.08, cw, 'The entity is its card: free form within the character limit, in the form that presents it best', { align: 'center' });

    // what surrounds the card
    const X = 5.6, W = 3.4, H = 1.15;
    const fm = t.box(X, 1.4, W, 1.6, 'Frontmatter', ['type · origin · verification · sync', 'product_impact · timeline_impact · unlocks', 'references · artifacts'], { fill: PAPER });
    const disk = t.box(X, 3.2, W, H, 'On disk', ['knowledge-graph/<Domain>/<Type>/<name>.md', 'One directory per type, 150 types'], { fill: PAPER });
    const idx = t.box(X, 4.55, W, H, 'In the index', ['Postgres schema per workspace', 'Full text, embeddings, ranking, states'], { fill: PAPER });
    const X2 = 9.45;
    const refs = t.box(X2, 1.4, W, 1.6, 'References', ['Relations to other entities', 'depends_on · implements · concerns · retires · plans', 'Validated by the gate, walked by Graph RAG'], { fill: WASH.kn });
    const arts = t.box(X2, 3.2, W, 1.6, 'Artifacts', ['Repository files beneath a summary', 'chats/ · plans/ · code', 'Written only by summarization'], { fill: WASH.kn });
    const states = t.box(X2, 5.0, W, 0.9, 'States', ['Verification, sync and contradictions', 'Shown on every card'], { fill: WASH.att });
    const card = { x: cx, y: cy, w: cw, h: ch, cx: cx + cw / 2, cy: cy + ch / 2 };
    t.edge(card, fm, null);
    t.edge(card, disk, null);
    t.edge(card, idx, null);
    t.edge(fm, refs, null);
    t.edge(fm, arts, null);
    t.edge(idx, states, null);
    t.note(0.6, 6.55, 12.1, 'An entity that does not fit the limit is split into entities that reference each other. Origin: added by the user, requested, or raised by an automation.', { align: 'center' });
  });

  // ---------------------------------------------------------------- 3. entity states
  blocks.push(async () => {
    const s = slide('entity states');
    const t = tools(s);
    t.header('Entity states');
    t.sub('Two independent axes on every entity, plus a count: verification is the user\'s judgement, sync is the entity against its artifact or implementation');
    // verification
    t.band(0.6, 1.4, 12.1, 1.55, WASH.att, 'Verification', 'A0402F');
    const un = t.pill(3.6, 2.3, 'unverified', STATE.unverified, { w: 1.6 });
    const ve = t.pill(9.7, 2.3, 'verified', STATE.verified, { w: 1.6 });
    t.arrow(un.x + un.w, un.cy - 0.1, ve.x, ve.cy - 0.1);
    t.note(5.0, 1.85, 3.3, 'Approval in the feed: one commit on the main line', { align: 'center', italic: true, color: INK });
    t.arrow(ve.x, ve.cy + 0.15, un.x + un.w, ve.cy + 0.15, { color: MUTED });
    t.note(5.0, 2.5, 3.3, 'Any rewrite by a run: written unverified, back in the feed', { align: 'center', italic: true, color: MUTED });
    t.note(0.75, 2.55, 2.6, 'Approved state = the system', { color: 'A0402F', size: 9 });
    t.note(10.7, 2.55, 1.9, 'Out of the feed', { color: 'A0402F', size: 9, align: 'right' });

    // sync
    t.band(0.6, 3.15, 12.1, 2.75, WASH.kn, 'Sync', '7C6224');
    const sy = t.pill(2.5, 4.55, 'synced', STATE.synced, { w: 1.5 });
    const ea = t.pill(6.4, 3.85, 'entity_ahead', STATE.entity_ahead, { w: 1.7 });
    const aa = t.pill(6.4, 5.35, 'artifact_ahead', STATE.artifact_ahead, { w: 1.7 });
    const up = t.pill(10.6, 4.55, 'updating', STATE.updating, { w: 1.5 });
    t.edge(sy, ea, 'approval, nothing implements it', { dy: -0.2 });
    t.edge(ea, up, 'implementation run on it', { dy: -0.2 });
    t.edge(sy, aa, 'artifact changed on the main line', { dy: 0.2 });
    t.edge(aa, up, 'summarization rewrite', { dy: 0.2 });
    t.edge(sy, up, 'run on it, e.g. a send back', { dy: -0.17 });
    t.arrow(up.x, up.cy + 0.12, sy.x + sy.w, sy.cy + 0.12, { color: MUTED });
    t.note(4.9, 4.72, 3.0, 'landed and approved', { align: 'center', italic: true, color: MUTED });
    t.note(0.75, 5.45, 2.9, 'Implementable types: Feature, FeatureRequest, UserStory, DevTask, Bug, TechDebt, Plan', { size: 8 });

    // contradictions
    t.band(0.6, 6.1, 12.1, 0.85, PAPER, null);
    s.addText('3', {
      shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.17, x: 0.85, y: 6.35, w: 0.42, h: 0.34, fill: { color: WASH.att }, line: { type: 'none' },
      color: 'A0402F', fontFace: head, fontSize: 12, bold: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true,
    });
    s.addText([
      { text: 'Contradictions', options: { bold: true, fontFace: head, fontSize: 11, color: INK, breakLine: true } },
      { text: 'Open contradiction issues the consistency check holds over the entity, counted from the references; not a git conflict', options: { fontFace: body, fontSize: 9, color: MUTED } },
    ], { x: 1.45, y: 6.18, w: 11.0, h: 0.7, valign: 'middle', margin: 0, isTextBox: true });
  });

  // ---------------------------------------------------------------- 4. automations
  blocks.push(async () => {
    const s = slide('automations');
    const t = tools(s);
    t.header('Automations');
    t.sub('Background loops per project, each defined by its responsibility alone; the definition is an entity in the harness, the trigger an entity in each workspace');
    const A = [
      ['Exploration', 'FaCompass', 'Next best action within the goals', ['schedule', 'on demand']],
      ['Preparation', 'FaListCheck', 'Plans for action points that can start', ['schedule', 'on demand']],
      ['Consistency check', 'FaScaleBalanced', 'Issues over the knowledge graph alone', ['schedule', 'on demand']],
      ['Retention', 'FaBroom', 'Retirement of entities whose lifetime is spent', ['schedule', 'on demand']],
      ['Optimization', 'FaWandMagicSparkles', 'Skills, sub-agents, definitions from the metrics', ['schedule', 'on demand']],
      ['Implementation', 'FaCode', 'Approved entity implemented in the repository', ['event: entity_ahead']],
      ['Validation', 'FaFlaskVial', 'Landed work and the project as it stands', ['schedule', 'event: implementation_finished']],
      ['Chat', 'FaComments', 'The direct line to the user', ['user']],
      ['Summarization', 'FaFileLines', 'Summary entities from artifacts', ['Stop hook', 'artifact change']],
      ['Graph build', 'FaDiagramProject', 'Knowledge graph from the repository, run after run', ['project enabled']],
    ];
    const TAG = { schedule: '7C6224', 'on demand': OK, user: OK, 'Stop hook': ACCENT, 'artifact change': ACCENT, 'project enabled': MUTED };
    const colour = (k) => TAG[k] ?? (k.startsWith('event') ? 'A0402F' : MUTED);
    const W = 2.3, H = 1.55, gx = 0.15, x0 = 0.6, y0 = 1.4;
    for (let i = 0; i < A.length; i++) {
      const [name, ic, what, tags] = A[i];
      const x = x0 + (i % 5) * (W + gx), y = y0 + Math.floor(i / 5) * (H + 0.2);
      t.box(x, y, W, H, '', [], { fill: 'FFFFFF' });
      await t.icon(ic, INK, x + 0.12, y + 0.12, 0.24);
      s.addText([
        { text: name, options: { bold: true, fontFace: head, fontSize: 11, color: INK, breakLine: true, paraSpaceAfter: 3 } },
        { text: what, options: { fontFace: body, fontSize: 8.5, color: MUTED } },
      ], { x: x + 0.44, y: y + 0.08, w: W - 0.52, h: 0.95, valign: 'top', margin: 0, isTextBox: true });
      let tx = x + 0.12;
      for (const k of tags) tx += t.tag(tx, y + H - 0.36, k, colour(k)) + 0.06;
    }
    // rules
    const y = 5.05;
    t.band(0.6, y, 12.1, 1.7, PAPER, null);
    const col = (x, title, lines) => s.addText([
      { text: title, options: { bold: true, fontFace: head, fontSize: 10.5, color: INK, breakLine: true, paraSpaceAfter: 3 } },
      ...lines.map((l, k) => ({ text: l, options: { fontFace: body, fontSize: 8.5, color: MUTED, bullet: { indent: 8 }, breakLine: k < lines.length - 1 } })),
    ], { x, y: y + 0.12, w: 3.85, h: 1.5, valign: 'top', margin: 0, isTextBox: true });
    col(0.8, 'Scheduling', ['Automation runs: one at a time per project, queued', 'User-started runs: at once, alongside', 'One total across projects', 'Loops pause when the feed is full']);
    col(4.75, 'Every run', ['One Claude Code process in its own checkout', 'Definition as instructions, summarization as a sub-agent', 'Guard hooks and the momentum-kb tools', 'Usage as a share of the 5-hour and weekly limits']);
    col(8.7, 'Cheapest mechanism per step', ['Queries and rules for indices, metrics, lifetimes, references', 'AI only for judgement: deciding, planning, reviewing, summarizing', 'Materialized into each workspace on approval']);
  });

  // ---------------------------------------------------------------- 5. summarization
  blocks.push(async () => {
    const s = slide('summarization');
    const t = tools(s);
    t.header('Summarization');
    t.sub('The only writer of summaries: a sub-agent every run calls from its Stop hook, and a run of its own when an artifact changes on the main line');
    const W = 2.35, H = 1.7, y = 1.6, xs = [0.45, 3.7, 6.95, 10.2];
    const r = t.box(xs[0], y, W, H, 'A run ends', ['Artifacts added, changed or deleted', 'Code, plans, chat transcript', 'Documents a graph build listed'], { fill: WASH.prod });
    const h = t.box(xs[1], y, W, H, 'Stop hook', ['Once per stop, before the run ends', 'Knowledge graph and excluded patterns left out', 'Character limit and presentation rules passed on'], { fill: WASH.kn });
    const a = t.box(xs[2], y, W, H, 'Summarization sub-agent', ['Each artifact read in full', 'One entity per coherent piece of work', 'Type from the artifact: chat, plan, result'], { fill: WASH.kn });
    const e = t.box(xs[3], y, W, H, 'Summary entities', ['Artifacts listed in the frontmatter', 'implements, plans, concerns references', 'Landed with the run, unverified'], { fill: WASH.att });
    t.edge(r, h, 'stop');
    t.edge(h, a, 'artifact list');
    t.edge(a, e, 'cards');
    const y2 = 4.1;
    const m = t.box(xs[0], y2, W, H, 'Main line change outside a run', ['The user\'s own commit', 'Artifacts changed under entities'], { fill: WASH.prod });
    const g = t.box(xs[1], y2, W, H, 'Consistency gate', ['Entities over the artifacts: artifact_ahead', 'Entities changed with their artifacts: in step'], { fill: WASH.kn });
    const sr = t.box(xs[2], y2, W, H, 'Summarization run', ['One run per change, event trigger', 'Every entity over the artifacts listed', 'Queued with the automation runs'], { fill: WASH.kn });
    const rw = t.box(xs[3], y2, W, H, 'Cards rewritten', ['Entity from its artifacts again', 'sync: synced', 'Back in the feed, unverified'], { fill: WASH.att });
    t.edge(m, g, 'indexed');
    t.edge(g, sr, 'artifact_ahead');
    t.edge(sr, rw, 'lands');
    t.note(0.6, 6.2, 12.1, 'No automation summarizes by itself, so none is limited by the card. The consistency check trusts summarization: it never reads the artifacts, so a summary must say what its artifacts say.', { align: 'center' });
  });

  // ---------------------------------------------------------------- 6. consistency gate
  blocks.push(async () => {
    const s = slide('consistency gate');
    const t = tools(s);
    t.header('Consistency gate');
    t.sub('The consistency guard on every change of a run, the transaction when it ends, and the consistency check loop over the knowledge graph');
    const W = 3.35, H = 2.5, y = 1.4;
    const a = t.box(0.45, y, W, H, 'Inside the run', [
      'PostToolUse hook: every knowledge-base write checked as it happens',
      'Stop hook: run sent back to fix what cannot pass, twice at most',
      'Watch on knowledge-graph/ for writes outside the tools',
      'momentum-kb write: issues returned at once',
    ], { fill: WASH.prod, bullets: true });
    const b = t.box(4.85, y, W, H, 'Transaction, when the run ends', [
      'Card within the character limit',
      'Type from entity-types.tsv, matching the directory',
      'Every reference resolving; no deletion still referenced',
      'Everything lands as one commit, valid or not',
      'Harness/Issue guard-<run> over what cannot pass',
    ], { fill: WASH.kn, bullets: true });
    const c = t.box(9.25, y, W, H, 'After landing', [
      'Index following the main line commit by commit',
      'Unverified entities in the feed, verified ones out',
      'Sync states and contradictions refreshed',
      'Consistency and open-issue metrics recorded',
    ], { fill: WASH.att, bullets: true });
    t.edge(a, b, 'stop');
    t.edge(b, c, 'landed');
    const y2 = 4.3;
    t.band(0.6, y2, 12.1, 2.1, PAPER, 'Consistency check loop', INK);
    s.addText([
      { text: 'Rule categories', options: { bold: true, fontFace: head, fontSize: 10.5, color: INK, breakLine: true, paraSpaceAfter: 3 } },
      { text: 'reference · card-limit · type-path', options: { fontFace: body, fontSize: 9, color: MUTED, breakLine: true, paraSpaceAfter: 8 } },
      { text: 'Content categories', options: { bold: true, fontFace: head, fontSize: 10.5, color: INK, breakLine: true, paraSpaceAfter: 3 } },
      { text: 'contradiction · repetition · ambiguity · design-gap · logical · naming · struct · verbose · split', options: { fontFace: body, fontSize: 9, color: MUTED } },
    ], { x: 0.8, y: y2 + 0.45, w: 5.6, h: 2.0, valign: 'top', margin: 0, isTextBox: true });
    s.addText([
      { text: 'One Harness/Issue per finding, concerning the entities at fault', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'Knowledge graph only: the artifacts behind a summary never opened', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'Open contradiction issues counted on each entity as its contradictions', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'Nothing fixed by the check itself: every change reaches the main line through a run and the feed', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 } } },
    ], { x: 6.7, y: y2 + 0.45, w: 5.8, h: 2.0, valign: 'top', margin: 0, isTextBox: true });
  });

  // ---------------------------------------------------------------- 7. git
  blocks.push(async () => {
    const s = slide('git');
    const t = tools(s);
    t.header('Git');
    t.sub('One branch per workspace: the main line. No run branches, no merges; every run lands as one commit, and approval is one commit more');
    const dot = (x, y, label, color = INK, below = true) => {
      s.addShape(pres.shapes.OVAL, { x: x - 0.11, y: y - 0.11, w: 0.22, h: 0.22, fill: { color: 'FFFFFF' }, line: { color, width: 2 } });
      if (label) t.note(x - 1.0, below ? y + 0.18 : y - 0.5, 2.0, label, { align: 'center', size: 8.5, italic: false, color });
    };
    const scene = (x0, y, title, commits, ok) => {
      t.note(x0, y - 1.55, 5.9, title, { size: 11, italic: true, color: INK });
      t.arrow(x0, y, x0 + 5.9, y, { width: 2, noHead: true, color: LINE });
      // the run's checkout above the line
      const co = t.box(x0 + 0.5, y - 1.2, 2.2, 0.75, 'Run checkout', ['Detached worktree at the tip', 'Changes while the run works'], { fill: WASH.prod, size: 8 });
      commits.forEach(([cx, label, color]) => dot(x0 + cx, y, label, color));
      return co;
    };
    const y1 = 2.9;
    const c1 = scene(0.6, y1, 'Main line unchanged while the run ran: fast-forward', [[0.5, 'tip at start'], [5.2, 'run landed', OK]], true);
    t.arrow(c1.x + c1.w, c1.cy, 0.6 + 5.2, y1 - 0.14, { color: OK });
    const c2 = scene(7.0, y1, 'Main line moved meanwhile: replay onto the new tip', [[0.5, 'tip at start'], [2.9, 'user commit', ACCENT], [5.2, 'run replayed', OK]], false);
    t.arrow(c2.x + c2.w, c2.cy, 7.0 + 5.2, y1 - 0.14, { color: OK });
    t.note(7.0, y1 + 0.55, 5.9, 'Conflicting files on the run\'s side; a Harness/Conflict entity in the same commit, concerning what conflicted', { size: 8.5, align: 'center' });
    // approval and the rest
    const y2 = 4.75;
    t.arrow(0.6, y2, 12.7, y2, { width: 2, noHead: true, color: LINE });
    dot(1.6, y2, 'run landed: entity unverified', INK);
    dot(5.0, y2, 'approval: verification verified', OK);
    dot(8.4, y2, 'user commit: artifacts changed', ACCENT);
    dot(11.6, y2, 'summarization run landed', INK);
    t.note(0.6, y2 - 0.45, 12.1, 'The one history: run landings, approvals and the user\'s own commits, each one commit', { size: 9, align: 'center' });
    const y3 = 5.7;
    t.band(0.6, y3, 12.1, 1.25, PAPER, null);
    s.addText([
      { text: 'Conflicts avoided by queueing: automation runs one at a time per project', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'The user\'s checkout updated where its files were clean; dirty files left alone', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'Run checkouts under .runs/<workspace>/<run-id>, removed once landed', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 } } },
    ], { x: 0.8, y: y3 + 0.12, w: 5.8, h: 1.05, valign: 'top', margin: 0, isTextBox: true });
    s.addText([
      { text: 'Never a push, never a branch: the harness commits and lands, runs never touch git', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'Reset: knowledge graph deleted from the main line in one commit, code untouched', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 }, breakLine: true } },
      { text: 'Legacy momentum/* branches landed once at startup, then deleted', options: { fontFace: body, fontSize: 9, color: INK, bullet: { indent: 8 } } },
    ], { x: 6.8, y: y3 + 0.12, w: 5.8, h: 1.05, valign: 'top', margin: 0, isTextBox: true });
  });

  // ---------------------------------------------------------------- 8. user actions
  blocks.push(async () => {
    const s = slide('user actions');
    const t = tools(s);
    t.header('User actions');
    t.sub('Everything the user does, from the feed, the chat tool, the explorer, settings or voice tools; every action is an API call');
    const U = { cx: 6.67, cy: 4.1 };
    s.addShape(pres.shapes.OVAL, { x: U.cx - 0.45, y: U.cy - 0.45, w: 0.9, h: 0.9, fill: { color: INK }, line: { type: 'none' }, shadow: shade() });
    await t.icon('FaUser', 'FFFFFF', U.cx - 0.2, U.cy - 0.2, 0.4);
    const user = { x: U.cx - 0.45, y: U.cy - 0.45, w: 0.9, h: 0.9, cx: U.cx, cy: U.cy };
    const W = 3.3, H = 1.2;
    const ACTIONS = [
      ['Approve', 'FaCheck', ['Swipe right in the feed', 'One commit: verification verified', 'Implementable and unimplemented: entity_ahead → implementation run'], WASH.att, 0.6, 1.35],
      ['Send back', 'FaRotateLeft', ['Swipe left with a comment', 'Chat run on the entity, sync updating', 'The comment decides: change, split, replace, retire'], WASH.att, 5.02, 1.35],
      ['Chat', 'FaComments', ['A question or steering, any time', 'Runs at once, alongside the automations', 'Results through the feed like any change'], WASH.prod, 9.43, 1.35],
      ['Run on demand', 'FaPlay', ['Any automation whose trigger allows it', 'Started from the chat tool or voice tools'], WASH.prod, 0.6, 3.5],
      ['Stop a run', 'FaStop', ['Process killed, usage shown until then', 'What it wrote still lands and reaches the feed'], WASH.prod, 9.43, 3.5],
      ['Projects and the graph build', 'FaToggleOn', ['Enable, disable: loops on or off', 'Build: stop, resume, reset', 'Usage and the full build estimate watched'], WASH.kn, 0.6, 5.65],
      ['Edit entities directly', 'FaPenToSquare', ['Any commit on the main line', 'Indexed and fed like a run\'s landing', 'Definitions and triggers included'], WASH.kn, 5.02, 5.65],
      ['Settings', 'FaGear', ['Feed size, card limit and rules', 'Lifetimes, exclusions, models', 'Runs in total across projects'], WASH.kn, 9.43, 5.65],
    ];
    for (const [name, ic, lines, fill, x, y] of ACTIONS) {
      const b = t.box(x, y, W, H, '', [], { fill });
      await t.icon(ic, INK, x + 0.12, y + 0.12, 0.22);
      s.addText([
        { text: name, options: { bold: true, fontFace: head, fontSize: 11, color: INK, breakLine: true, paraSpaceAfter: 3 } },
        ...lines.map((l, k) => ({ text: l, options: { fontFace: body, fontSize: 8.5, color: MUTED, breakLine: k < lines.length - 1 } })),
      ], { x: x + 0.42, y: y + 0.08, w: W - 0.5, h: H - 0.12, valign: 'top', margin: 0, isTextBox: true });
      t.edge(user, b, null, { color: MUTED, noHead: true, dash: 'dash' });
    }
  });
  const only = process.env.MECH ? process.env.MECH.split(",").map(Number) : null;
  for (let i = 0; i < blocks.length; i++) if (!only || only.includes(i + 1)) await blocks[i]();
};
