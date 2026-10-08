// Scene 4, after the deck's "Entities", "Entity types" and "Entity states". The Explorer fills the frame with a
// repository's files; they burst out of the screen and gather into a graph of cards floating over it, which turns
// to show each card's type, then drops back into the Explorer's tree. The camera dives into one card, where approval
// verifies it and a rewrite asks again.
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Glyph, TypePill } from '../kit/app.tsx';
import { Desktop, DomainBadge, StateBadge, WINDOW } from '../kit/desktop.tsx';
import { Backdrop, TopHeadline } from '../kit/stage.tsx';
import { C, F, ICONS, domainOf } from '../kit/theme.ts';
import { mix, pop, ramp, typed } from '../kit/motion.ts';

export const GRAPH_FRAMES = 510;

// The window, front on: where its parts sit on the frame
const S = 1.1;
const WIN = { x: 960 - (WINDOW.w / 2) * S, y: 585 - (WINDOW.h / 2) * S };
const PANE = 420;
const ROW = 48;
const at = (x: number, y: number) => ({ x: WIN.x + x * S, y: WIN.y + y * S });

// Beats
const BURST = 74;
const FLY = 46;
const TURN = { from: 150, to: 300 };
const HOME = 304;
const LAND = (k: number) => HOME + 8 + k * 5;
const SELECT = 368;
const VERIFY = 412;
const REWRITE = 448;
const SETTLED = 484;

type Node = { type: string; title: string; files: string[]; x: number; y: number };
/** The graph of bookshelf-api: each card claims the files beneath it; positions round the centre of the frame */
const NODES: Node[] = [
  { type: 'Product/Product', title: 'Bookshelf', files: ['README.md', 'docs/overview.md', 'LICENSE'], x: -700, y: -90 },
  { type: 'Product/Goal', title: 'Readers find a book fast', files: ['docs/goals.md', 'docs/metrics.md'], x: -250, y: -250 },
  { type: 'Governance/DesignDoc', title: 'Bookshelf API design', files: ['docs/design.md', 'docs/decisions/001-store.md', 'docs/decisions/002-ids.md', 'docs/decisions/003-search.md'], x: -620, y: 140 },
  { type: 'Architecture/Api', title: 'Books API', files: ['src/server.js', 'src/routes/index.js', 'src/routes/books.js', 'src/routes/health.js', 'src/http/send.js', 'src/http/read-json.js'], x: 0, y: 0 },
  { type: 'Architecture/Component', title: 'Book store', files: ['src/store.js', 'src/store/memory.js', 'src/store/index.js'], x: 300, y: -230 },
  { type: 'Data/Schema', title: 'Book', files: ['src/models/book.js', 'src/validate.js', 'src/models/index.js'], x: 580, y: -60 },
  { type: 'Testing/TestSuite', title: 'Books API tests', files: ['test/books.test.js', 'test/store.test.js', 'test/validate.test.js', 'test/health.test.js', 'test/helpers.js', 'test/fixtures/books.json'], x: 230, y: 250 },
  { type: 'Infrastructure/Pipeline', title: 'CI pipeline', files: ['.github/workflows/ci.yml', 'package.json', 'package-lock.json', '.nvmrc'], x: -270, y: 260 },
  { type: 'Code/Repository', title: 'bookshelf-api', files: ['.gitignore', '.editorconfig', 'eslint.config.js', 'tsconfig.json', '.prettierrc', 'CHANGELOG.md', 'scripts/seed.js'], x: 700, y: 300 },
];
const EDGES: [number, number][] = [
  [0, 1], [1, 3], [2, 3], [2, 1], [3, 4], [4, 5], [3, 6], [7, 6], [8, 3], [0, 2], [5, 6],
];
// Spread round the centre a little narrower than the frame, so the graph keeps inside it as it turns
for (const n of NODES) n.x *= 0.84;
const FILES = NODES.flatMap((n, k) => n.files.map((name) => ({ name, k })));
const GRAPH_C = { x: 960, y: 560 };

/** Where the i-th file sits in the window's listing */
function fileHome(i: number) {
  const col = Math.floor(i / 13);
  const row = i % 13;
  return at(WINDOW.nav + PANE + 36 + col * 250, WINDOW.bar + 70 + row * 38);
}
/** Where the k-th card's row sits in the window's tree */
const rowHome = (k: number) => at(WINDOW.nav + 40, WINDOW.bar + 100 + k * ROW + ROW / 2);

export function Graph() {
  const f = useCurrentFrame();
  const enter = pop(f, 0);
  // The window leans back into a table under the floating graph, then rises again to take the cards in
  const lean = ramp(f, BURST - 6, 30, Easing.inOut(Easing.cubic)) * (1 - ramp(f, HOME - 34, 30, Easing.inOut(Easing.cubic)));
  // The dive into the selected card
  const dive = ramp(f, SELECT + 6, 36, Easing.inOut(Easing.cubic));
  const turn = Math.sin(Math.PI * ramp(f, TURN.from, TURN.to - TURN.from, Easing.inOut(Easing.sin)));
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '960px 300px' }}>
        <Desktop
          tab="explorer"
          url="momentum / explorer / bookshelf-api"
          style={{
            left: WIN.x,
            top: WIN.y,
            transformOrigin: '0 0',
            opacity: enter,
            filter: `saturate(${1 - 0.4 * lean})`,
            transform: `translateY(${60 * (1 - enter) + 200 * lean}px) scale(${S}) rotateX(${38 * lean}deg)`,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, transformOrigin: `${PANE + 300}px 140px`, transform: `translate(${-40 * dive}px, ${120 * dive}px) scale(${mix(dive, 1, 1.6)})` }}>
            <div style={{ opacity: 1 - 0.75 * dive }}>
              <Tree f={f} />
            </div>
            <Entity f={f} />
          </div>
        </Desktop>
      </AbsoluteFill>
      <Files f={f} />
      <GraphLayer f={f} turn={turn} />
      <Landing f={f} />
      <StateLens f={f} />
      <TopHeadline frame={f} from={4} to={BURST - 2} tag="Knowledge graph" color={C.warn} text="38 files." sub="One small repository, as you would read it." />
      <TopHeadline frame={f} from={BURST} to={TURN.from - 2} tag="Knowledge graph" color={C.warn} text="Cards, not files." sub="Each card claims the files it accounts for." />
      <TopHeadline frame={f} from={TURN.from} to={HOME - 2} tag="Types" color={C.warn} text="Every card has a type." sub="Its domain's colour and glyph, wherever the app shows it." />
      <TopHeadline frame={f} from={HOME + 40} to={GRAPH_FRAMES} tag="States" color={C.warn} text="You verify it." sub="Approval verifies; a rewrite brings it back to you." />
    </AbsoluteFill>
  );
}

/** The files, listed in the window, then bursting towards the viewer into the cards that claim them */
function Files({ f }: { f: number }) {
  if (f > BURST + FLY + 40) return null;
  return (
    <>
      {FILES.map(({ name, k }, i) => {
        const home = fileHome(i);
        const n = NODES[k]!;
        const start = BURST + (i % 13) * 1.4 + Math.floor(i / 13) * 3;
        const t = ramp(f, start, FLY, Easing.inOut(Easing.cubic));
        const x = mix(t, home.x, GRAPH_C.x + n.x);
        const y = mix(t, home.y, GRAPH_C.y + n.y) - 220 * Math.sin(Math.PI * t);
        // Rushing towards the viewer mid-flight, then into the card
        const scale = mix(t, 1, 0.3) + 1.2 * Math.sin(Math.PI * t);
        return (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(${-8 * S}px, -50%) scale(${scale * S * pop(f, 6 + i * 0.6)})`,
              transformOrigin: 'left center',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: F.mono,
              fontSize: 14,
              color: C.ink,
              whiteSpace: 'nowrap',
              opacity: 1 - ramp(f, start + FLY - 8, 8),
              filter: `blur(${2.5 * Math.sin(Math.PI * t)}px)`,
              background: t > 0 ? C.surface : 'transparent',
              borderRadius: 6,
              padding: t > 0 ? '2px 6px' : 0,
              boxShadow: t > 0 ? '0 6px 14px rgba(30,41,59,.15)' : undefined,
            }}
          >
            <Glyph path="M6 2h8l6 6v14H6zM14 2v6h6" size={14} color={C.muted} stroke />
            {name}
          </div>
        );
      })}
      {f < BURST + 20 ? (
        <div style={{ position: 'absolute', left: fileHome(0).x, top: fileHome(0).y - 44 * S, fontFamily: F.mono, fontSize: 15 * S, color: C.muted, opacity: 1 - ramp(f, BURST, 16) }}>
          bookshelf-api / 38 files
        </div>
      ) : null}
    </>
  );
}

/** The graph floating over the window: cards gathering their files, references drawing, the whole turning */
function GraphLayer({ f, turn }: { f: number; turn: number }) {
  if (f < BURST + 10 || f > HOME + 50) return null;
  const shown = ramp(f, TURN.from + 10, 20);
  return (
    <AbsoluteFill style={{ perspective: 1600, perspectiveOrigin: `${GRAPH_C.x}px ${GRAPH_C.y}px` }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformOrigin: `${GRAPH_C.x}px ${GRAPH_C.y}px`, transform: `rotateY(${20 * turn}deg) rotateX(${-8 * turn}deg)` }}>
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {EDGES.map(([a, b], i) => {
            const A = NODES[a]!;
            const B = NODES[b]!;
            const draw = ramp(f, BURST + FLY + 4 + i * 3, 16) * (1 - ramp(f, HOME - 10, 12));
            return (
              <path key={i} d={`M${GRAPH_C.x + A.x} ${GRAPH_C.y + A.y} L${GRAPH_C.x + B.x} ${GRAPH_C.y + B.y}`} pathLength={1} stroke={C.warn} strokeOpacity={0.5} strokeWidth={4} strokeDasharray="1" strokeDashoffset={1 - draw} fill="none" />
            );
          })}
        </svg>
        {NODES.map((n, k) => {
          const t = pop(f, BURST + FLY - 10 + k * 1.5, true);
          if (f >= LAND(k) - 18) return null;
          const d = domainOf(n.type);
          return (
            <div
              key={n.title}
              style={{
                position: 'absolute',
                left: GRAPH_C.x + n.x,
                top: GRAPH_C.y + n.y,
                transform: `translate(-50%, -50%) scale(${t * (1 + 0.12 * shown)})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: C.surface,
                  border: `3px solid ${shown > 0 ? d.color : C.line}`,
                  borderRadius: 18,
                  padding: '12px 20px 12px 12px',
                  boxShadow: `0 ${20 + 20 * turn}px 40px rgba(30,41,59,.18), 0 0 ${30 * shown}px ${d.color}55`,
                  whiteSpace: 'nowrap',
                }}
              >
                <DomainBadge type={n.type} size={44} />
                <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink }}>{n.title}</span>
              </div>
              <div style={{ opacity: shown, transform: `translateY(${-8 * (1 - shown)}px)` }}>
                <TypePill type={n.type} size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** The cards dropping back into the window's tree */
function Landing({ f }: { f: number }) {
  if (f < HOME - 20 || f > LAND(NODES.length) + 20) return null;
  return (
    <>
      {NODES.map((n, k) => {
        const t = ramp(f, LAND(k) - 18, 18, Easing.inOut(Easing.cubic));
        if (t <= 0 || t >= 1) return null;
        const home = rowHome(k);
        return (
          <div
            key={n.title}
            style={{
              position: 'absolute',
              left: mix(t, GRAPH_C.x + n.x, home.x),
              top: mix(t, GRAPH_C.y + n.y, home.y),
              transform: `translate(-50%, -50%) scale(${mix(t, 1, 0.6)})`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: C.surface,
              borderRadius: 14,
              padding: '8px 14px 8px 8px',
              boxShadow: '0 12px 24px rgba(30,41,59,.2)',
              whiteSpace: 'nowrap',
            }}
          >
            <DomainBadge type={n.type} size={36} />
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 22, color: C.ink }}>{n.title}</span>
          </div>
        );
      })}
    </>
  );
}

/** The Explorer's tree, a row per card as it lands */
function Tree({ f }: { f: number }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: PANE, borderRight: `1px solid ${C.line}`, background: C.surface }}>
      <div style={{ position: 'absolute', left: 20, right: 20, top: 22, height: 44, borderRadius: 12, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontFamily: F.body, fontSize: 15, color: C.muted }}>
        <Glyph path={ICONS.search} size={18} color={C.muted} />
        Search by words or meaning
      </div>
      {NODES.map((n, k) => {
        const landed = f >= LAND(k);
        const selected = n.title === 'Books API' && f >= SELECT;
        return (
          <div
            key={n.title}
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top: 100 + k * ROW,
              height: ROW - 6,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 12,
              opacity: landed ? 1 : 0,
              transform: `scale(${landed ? pop(f, LAND(k), true) : 0.8})`,
              background: selected ? C.accent + '1F' : 'transparent',
              boxSizing: 'border-box',
            }}
          >
            <DomainBadge type={n.type} size={30} />
            <span style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: C.ink, fontWeight: selected ? 700 : 400 }}>{n.title}</span>
            <span style={{ fontFamily: F.body, fontSize: 12, color: domainOf(n.type).color }}>{n.type.split('/')[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

const ADDED = ', and search by author or title';

/** The selected card, opened beside the tree */
function Entity({ f }: { f: number }) {
  if (f < SELECT) return null;
  const part = (k: number) => {
    const t = pop(f, SELECT + 2 + k * 3);
    return { opacity: t, transform: `translateY(${14 * (1 - t)}px)` };
  };
  const verified = f >= VERIFY && f < SETTLED;
  const updating = f >= REWRITE && f < SETTLED;
  const added = typed(ADDED, f, REWRITE + 6, 40);
  return (
    <div style={{ position: 'absolute', left: PANE + 48, top: 40, right: 48 }}>
      <div style={part(0)}>
        <TypePill type="Architecture/Api" size={15} />
      </div>
      <div style={{ ...part(1), fontFamily: F.head, fontWeight: 700, fontSize: 38, color: C.ink, margin: '16px 0 14px' }}>Books API</div>
      <div style={{ ...part(2), display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <StateBadge state={verified ? 'verified' : 'unverified'} />
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
    </div>
  );
}

/** What is happening to the card's states, under the zoomed window */
function StateLens({ f }: { f: number }) {
  const t = pop(f, VERIFY - 16) * (1 - ramp(f, GRAPH_FRAMES - 10, 10));
  if (t <= 0) return null;
  const verified = f >= VERIFY && f < SETTLED;
  const updating = f >= REWRITE && f < SETTLED;
  const bump = (from: number) => (f >= from && f < from + 14 ? Math.sin((Math.PI * (f - from)) / 14) : 0);
  const caption = f >= SETTLED ? 'Rewritten: back to you' : updating ? 'A run rewrites it' : verified ? 'You approved it' : 'Waiting for you';
  return (
    <div style={{ position: 'absolute', left: 960, top: 990, transform: `translate(-50%, -50%) translateY(${30 * (1 - t)}px)`, opacity: t, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
      <div style={{ transform: `scale(${1 + 0.15 * Math.max(bump(VERIFY), bump(REWRITE), bump(SETTLED))})`, fontFamily: F.body, fontWeight: 700, fontSize: 30, color: verified && !updating ? C.stateVerified : updating ? C.stateUpdating : C.stateUnverified, background: C.surface, borderRadius: 999, padding: '10px 28px', boxShadow: '0 10px 24px rgba(30,41,59,.16)' }}>{caption}</div>
    </div>
  );
}
