// Scene 4, after the deck's "Entities", "Entity types" and "Entity states": the Explorer on a wide screen. The files
// of a repository dissolve into a tree of typed cards; a card opens with its references; approval verifies it and a
// run's rewrite makes it unverified again.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Glyph, TypePill } from '../kit/app.tsx';
import { Desktop, DomainBadge, Pointer, StateBadge, WINDOW } from '../kit/desktop.tsx';
import { Backdrop, Headline } from '../kit/stage.tsx';
import { C, DOMAINS, F, ICONS } from '../kit/theme.ts';
import { mix, pop, ramp, typed } from '../kit/motion.ts';

export const GRAPH_FRAMES = 480;

const AT = { x: 1300, y: 545, scale: 0.84 };
const PANE = 420;
const ROW = 48;

const FILES = ['README.md', 'package.json', 'docs/design.md', 'src/server.js', 'src/routes/books.js', 'src/store.js', 'src/validate.js', 'test/books.test.js', 'test/store.test.js'];

type Row = { label: string; type: string; count?: number; depth: number; parent?: string; leaf?: boolean };
const ROWS: Row[] = [
  { label: 'Product', type: 'Product', count: 3, depth: 0 },
  { label: 'Governance', type: 'Governance', count: 2, depth: 0 },
  { label: 'Architecture', type: 'Architecture', count: 4, depth: 0 },
  { label: 'Api', type: 'Architecture/Api', count: 1, depth: 1, parent: 'Architecture' },
  { label: 'Books API', type: 'Architecture/Api', depth: 2, parent: 'Api', leaf: true },
  { label: 'Component', type: 'Architecture/Component', count: 2, depth: 1, parent: 'Architecture' },
  { label: 'Event', type: 'Architecture/Event', count: 1, depth: 1, parent: 'Architecture' },
  { label: 'Code', type: 'Code', count: 5, depth: 0 },
  { label: 'Data', type: 'Data', count: 1, depth: 0 },
  { label: 'Testing', type: 'Testing', count: 2, depth: 0 },
];

// Beats
const DISSOLVE = 34;
const OPEN_ARCH = 168;
const OPEN_API = 200;
const SELECT = 226;
const BURST = 254;
const VERIFY = 330;
const REWRITE = 382;
const SETTLED = 428;

/** Where the pointer is, in the window's own coordinates */
function pointerAt(f: number): { x: number; y: number; o: number; click: number } {
  const keys = [
    { f: 140, x: 700, y: 500 },
    { f: OPEN_ARCH - 4, x: WINDOW.nav + 120, y: rowY(2) + 24 },
    { f: OPEN_API - 4, x: WINDOW.nav + 140, y: rowY(3) + 24 },
    { f: SELECT - 4, x: WINDOW.nav + 170, y: rowY(4) + 24 },
    { f: 290, x: WINDOW.nav + 220, y: rowY(4) + 30 },
  ];
  const x = interpolate(f, keys.map((k) => k.f), keys.map((k) => k.x), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const y = interpolate(f, keys.map((k) => k.f), keys.map((k) => k.y), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const click = Math.max(...[OPEN_ARCH, OPEN_API, SELECT].map((c) => (f >= c && f < c + 12 ? (f - c) / 12 : 0)));
  return { x, y, o: ramp(f, 140, 10) * (1 - ramp(f, 296, 10)), click };
}
/** The top of the tree's i-th row once everything above it is open */
const rowY = (i: number) => WINDOW.bar + 100 + i * ROW;

function Tree({ f }: { f: number }) {
  const open: Record<string, number> = { Architecture: ramp(f, OPEN_ARCH, 14, Easing.out(Easing.cubic)), Api: ramp(f, OPEN_API, 14, Easing.out(Easing.cubic)) };
  let y = 100;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: PANE, borderRight: `1px solid ${C.line}`, background: C.surface }}>
      <div style={{ position: 'absolute', left: 20, right: 20, top: 22, height: 44, borderRadius: 12, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontFamily: F.body, fontSize: 15, color: C.muted }}>
        <Glyph path={ICONS.search} size={18} color={C.muted} />
        Search by words or meaning
      </div>
      {ROWS.map((r, i) => {
        // A row inside a folder takes its height as the folder opens
        const h = r.parent ? (r.parent === 'Api' ? open.Api! * open.Architecture! : open.Architecture!) : 1;
        const top = y;
        y += ROW * h;
        const shown = r.depth === 0 ? pop(f, DISSOLVE + 18 + i * 4, true) : h;
        const selected = r.leaf && f >= SELECT;
        const folderOpen = open[r.label] ?? 0;
        return (
          <div
            key={r.label}
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top,
              height: ROW - 6,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 12 + r.depth * 26,
              opacity: shown,
              transform: r.depth === 0 ? `translateX(${-30 * (1 - shown)}px)` : `scaleY(${h})`,
              background: selected ? C.accent + '1F' : 'transparent',
              boxSizing: 'border-box',
            }}
          >
            {r.leaf ? null : (
              <div style={{ width: 8, height: 8, borderRight: `1.5px solid ${C.muted}`, borderBottom: `1.5px solid ${C.muted}`, transform: `rotate(${mix(folderOpen, -45, 45)}deg)`, marginRight: 2 }} />
            )}
            <DomainBadge type={r.type} size={r.depth === 0 ? 30 : 26} />
            <span style={{ flex: 1, fontFamily: r.leaf ? F.head : F.body, fontWeight: r.leaf ? 700 : 400, fontSize: r.leaf ? 17 : 16, color: C.ink }}>{r.label}</span>
            {r.count ? <span style={{ fontFamily: F.body, fontSize: 13, color: C.muted, background: C.card, borderRadius: 999, padding: '1px 9px' }}>{r.count}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

/** The repository as files, dissolving into the graph */
function Files({ f }: { f: number }) {
  if (f > DISSOLVE + 70) return null;
  return (
    <div style={{ position: 'absolute', left: PANE + 40, top: 40, right: 40 }}>
      <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted, marginBottom: 18, opacity: 1 - ramp(f, DISSOLVE + 30, 20) }}>bookshelf-api / 38 files</div>
      {FILES.map((name, i) => {
        const t = ramp(f, DISSOLVE + i * 4, 22, Easing.in(Easing.cubic));
        return (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 44,
              fontFamily: F.mono,
              fontSize: 18,
              color: C.ink,
              opacity: (1 - t) * pop(f, i * 2),
              filter: `blur(${8 * t}px)`,
              transform: `translateX(${-420 * t}px) scale(${1 - 0.3 * t})`,
            }}
          >
            <Glyph path="M6 2h8l6 6v14H6zM14 2v6h6" size={20} color={C.muted} stroke />
            {name}
          </div>
        );
      })}
    </div>
  );
}

const REFS: [string, string, string][] = [
  ['Product/Goal', 'Readers find a book fast', 'realises'],
  ['Architecture/Component', 'Book store', 'uses'],
  ['Testing/TestSuite', 'Books API tests', 'tested by'],
];
const ADDED = ', and search by author or title';

function Entity({ f }: { f: number }) {
  if (f < SELECT) return null;
  const part = (k: number) => {
    const t = pop(f, SELECT + 4 + k * 4);
    return { opacity: t, transform: `translateY(${16 * (1 - t)}px)` };
  };
  const verified = f >= VERIFY && f < SETTLED;
  const updating = f >= REWRITE && f < SETTLED;
  const flip = (at: number) => (f >= at && f < at + 16 ? Math.sin((Math.PI * (f - at)) / 16) : 0);
  const verificationPulse = Math.max(flip(VERIFY), flip(SETTLED));
  const added = typed(ADDED, f, REWRITE + 10, 36);
  return (
    <div style={{ position: 'absolute', left: PANE + 48, top: 40, right: 48 }}>
      <Burst f={f} />
      <div style={part(0)}>
        <TypePill type="Architecture/Api" size={15} />
      </div>
      <div style={{ ...part(1), fontFamily: F.head, fontWeight: 700, fontSize: 38, color: C.ink, margin: '16px 0 14px' }}>Books API</div>
      <div style={{ ...part(2), display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <StateBadge state={verified ? 'verified' : 'unverified'} style={{ transform: `scale(${1 + 0.25 * verificationPulse})` }} />
          {verificationPulse > 0 ? (
            <div style={{ position: 'absolute', inset: -8, borderRadius: 999, border: `3px solid ${verified ? C.stateVerified : C.stateUnverified}`, opacity: 1 - (f - (verified ? VERIFY : SETTLED)) / 16, transform: `scale(${1 + (f - (verified ? VERIFY : SETTLED)) / 16})` }} />
          ) : null}
        </div>
        <StateBadge state={updating ? 'updating' : 'synced'} spin={updating ? (f - REWRITE) * 9 : 0} />
        <span style={{ fontFamily: F.body, fontSize: 13.5, color: C.muted }}>0 contradictions</span>
      </div>
      <div style={{ ...part(3), fontFamily: F.body, fontSize: 18, lineHeight: '27px', color: C.muted, marginBottom: 14 }}>
        The HTTP routes over the book store: list, read and add
        {added ? <span style={{ background: 'rgba(63,107,82,.28)', borderRadius: 4, color: C.ink }}>{added}</span> : null}.
      </div>
      {['GET /books, GET /books/:id, POST /books', 'Every request validated; 400 on invalid input'].map((b, k) => (
        <div key={b} style={{ ...part(4 + k), display: 'flex', gap: 10, fontFamily: F.body, fontSize: 17, lineHeight: '26px', color: C.ink, marginBottom: 6 }}>
          <span>•</span>
          {b}
        </div>
      ))}
      <Fold title="References" count={3} style={part(6)} />
      {REFS.map(([type, title, note], k) => (
        <div key={title} style={{ ...part(7 + k), display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: `1px solid ${C.line}` }}>
          <DomainBadge type={type} size={30} />
          <span style={{ flex: 1, fontFamily: F.body, fontSize: 17, color: C.ink }}>{title}</span>
          <span style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>{note}</span>
        </div>
      ))}
      <Fold title="Artifacts" count={2} style={part(10)} />
      {['src/routes/books.js', 'test/books.test.js'].map((p, k) => (
        <div key={p} style={{ ...part(11 + k), fontFamily: F.mono, fontSize: 15, color: C.ink, padding: '7px 0' }}>
          {p}
        </div>
      ))}
    </div>
  );
}

function Fold({ title, count, style }: { title: string; count: number; style: object }) {
  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 6 }}>
      <div style={{ width: 8, height: 8, borderRight: `1.5px solid ${C.muted}`, borderBottom: `1.5px solid ${C.muted}`, transform: 'rotate(45deg)' }} />
      <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 18, color: C.ink }}>{title}</span>
      <span style={{ fontFamily: F.body, fontSize: 13, color: C.muted, background: C.card, borderRadius: 999, padding: '1px 9px' }}>{count}</span>
    </div>
  );
}

/** Every main type bursting out of the card's type, and back */
function Burst({ f }: { f: number }) {
  const out = ramp(f, BURST, 14);
  const back = ramp(f, BURST + 56, 16, Easing.in(Easing.cubic));
  const t = out * (1 - back);
  if (t <= 0) return null;
  const all = Object.keys(DOMAINS);
  return (
    <div style={{ position: 'absolute', left: -48, top: -40, width: 768, height: 756, zIndex: 10 }}>
      <div style={{ position: 'absolute', inset: 0, background: C.screen, opacity: 0.92 * Math.min(1, t * 1.5) }} />
      {all.map((name, i) => {
        const a = (i / all.length) * Math.PI * 2 - Math.PI / 2;
        const ti = ramp(f, BURST + i * 1.5, 18, Easing.out(Easing.back(1.6))) * (1 - back);
        return (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: 384 + Math.cos(a) * 250 * ti,
              top: 330 + Math.sin(a) * 230 * ti,
              transform: `translate(-50%, -50%) scale(${ti})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <DomainBadge type={name} size={64} />
            <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 700, color: DOMAINS[name]!.color }}>{name}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 384, top: 330, transform: `translate(-50%, -50%) scale(${t})`, fontFamily: F.head, fontWeight: 700, fontSize: 30, color: C.ink, whiteSpace: 'nowrap' }}>
        {all.length} domains
      </div>
    </div>
  );
}

export function Graph() {
  const f = useCurrentFrame();
  const enter = pop(f, 0);
  const ry = interpolate(f, [0, GRAPH_FRAMES], [-15, -4]);
  const p = pointerAt(f);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: `${AT.x}px ${AT.y}px` }}>
        <Desktop
          tab="explorer"
          url="momentum / explorer / bookshelf-api"
          style={{
            left: AT.x - WINDOW.w / 2,
            top: AT.y - WINDOW.h / 2,
            opacity: enter,
            transform: `translateY(${40 * (1 - enter)}px) scale(${AT.scale}) rotateY(${ry}deg)`,
          }}
        >
          <Tree f={f} />
          <Files f={f} />
          <Entity f={f} />
          <Pointer x={p.x - WINDOW.nav} y={p.y - WINDOW.bar} opacity={p.o} click={p.click} />
        </Desktop>
      </AbsoluteFill>
      <StateLens f={f} />
      <Headline frame={f} from={2} to={140} tag="Knowledge graph" color={C.warn} text="Cards, not files." sub="Every project read as a graph of entity cards." />
      <Headline frame={f} from={144} to={298} tag="Types" color={C.warn} text="Every card has a type." sub="Each domain with its own colour and glyph." />
      <Headline frame={f} from={302} to={GRAPH_FRAMES} tag="States" color={C.warn} text="You verify it." sub="Approval verifies; a rewrite brings it back to you." />
    </AbsoluteFill>
  );
}

/** The card's states, large below the window while they change */
function StateLens({ f }: { f: number }) {
  const t = pop(f, VERIFY - 20) * (1 - ramp(f, GRAPH_FRAMES - 12, 12));
  if (t <= 0) return null;
  const verified = f >= VERIFY && f < SETTLED;
  const updating = f >= REWRITE && f < SETTLED;
  const bump = (at: number) => (f >= at && f < at + 14 ? Math.sin((Math.PI * (f - at)) / 14) : 0);
  return (
    <div style={{ position: 'absolute', left: AT.x, top: 975, transform: `translate(-50%, -50%) translateY(${30 * (1 - t)}px)`, opacity: t, display: 'flex', gap: 28, alignItems: 'center' }}>
      <StateBadge state={verified ? 'verified' : 'unverified'} style={{ transform: `scale(${2 + 0.4 * Math.max(bump(VERIFY), bump(SETTLED))})`, margin: '0 60px' }} />
      <StateBadge state={updating ? 'updating' : 'synced'} spin={updating ? (f - REWRITE) * 9 : 0} style={{ transform: `scale(${2 + 0.4 * bump(REWRITE)})`, margin: '0 60px' }} />
    </div>
  );
}
