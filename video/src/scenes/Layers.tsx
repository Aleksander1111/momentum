// Scene 1, after the deck's "Harness & Products": the three layers. Projects pour into one feed (attention), a card
// is approved, the phone tilts onto the knowledge graph (understanding) and the runs below it (implementation), whose
// work rises through the guard and lands back in the feed as one card.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, ProjectMark, SLOT, Stamp, type Entity, type Project } from '../kit/app.tsx';
import { Backdrop, Finger, Headline, Logo } from '../kit/stage.tsx';
import { C, F, LAYERS, PARTS, domainOf, type Layer } from '../kit/theme.ts';
import { dwell, dwelt, mix, pop, ramp } from '../kit/motion.ts';
import { type Cue, Voice, voiceDwells } from '../kit/voice.tsx';

export const LAYERS_FRAMES = 490;

const PROJECTS: Record<string, Project> = {
  bookshelf: { name: 'bookshelf', color: '#1D6FD6' },
  handbook: { name: 'handbook', color: '#7C3AED' },
  notes: { name: 'notes', color: '#0F766E' },
  todo: { name: 'to-do app', color: '#C2410C' },
};

/** The feed as it fills: lowest rank first, so the top-ranked card lands last, on top */
const INCOMING: (Entity & { rank: number; chip: [number, number] })[] = [
  {
    rank: 4,
    chip: [1640, 760],
    project: PROJECTS.todo!,
    type: 'Product/Feature',
    title: 'A priority for every to-do',
    desc: 'Low, normal or high, and the list sorted by it.',
    bullets: ['Low, normal or high', 'Shown in every list'],
    state: 'unverified',
  },
  {
    rank: 3,
    chip: [900, 860],
    project: PROJECTS.notes!,
    type: 'Product/Feature',
    title: 'Shared notes',
    desc: 'Share a note with anyone, to read or to edit.',
    bullets: ['A link per note', 'Revoke at any time'],
    state: 'unverified',
  },
  {
    rank: 2,
    chip: [1640, 250],
    project: PROJECTS.handbook!,
    type: 'Governance/Policy',
    title: 'Remote work policy',
    desc: 'Up to three remote days a week; Tuesday is a studio day for all.',
    bullets: ['Core hours 10:00 to 16:00', 'Messages answered within two hours'],
    state: 'unverified',
  },
  {
    rank: 1,
    chip: [900, 170],
    project: PROJECTS.bookshelf!,
    type: 'Product/Goal',
    title: 'Readers find a book fast',
    desc: 'A reader finds a book by author or title in one step.',
    bullets: ['Not met yet: there is no search', 'Measured in clicks per book found'],
    state: 'unverified',
  },
];

/** What the runs deliver for the approved goal: one card over the whole change */
const DELIVERED: Entity = {
  project: PROJECTS.bookshelf!,
  type: 'Product/Feature',
  title: 'Search by author or title',
  desc: 'Readers can now find a book by author or title.',
  bullets: ['Planned, done and checked', 'Ready for your review', 'Meets: Readers find a book fast'],
  state: 'unverified',
};

// Beats, in frames
const LAND = (i: number) => 22 + i * 14;
const FLY = 20;
const APPROVE = { show: 100, press: 126, drag: 130, release: 158 };
const TILT = 172;
const UNDERSTAND = 206;
const IMPLEMENT = 290;
const RISE = 384;
const ARRIVE = 421;
const CLOSE = 455;

// The stack: square planes, one per layer, the phone lying on the top one
const STAGE = { x: 1270, y: 540 };
const P = 940;
const GAP = 480;

function Plane({ layer, z, opacity, glow, label = 1, children }: { layer: Layer; z: number; opacity: number; glow: number; label?: number; children?: ReactNode }) {
  const l = LAYERS[layer];
  const face: CSSProperties = { position: 'absolute', inset: 0, borderRadius: 56 };
  return (
    <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${z}px)`, opacity }}>
      {/* The slab's edge, a little below its face */}
      <div style={{ ...face, background: l.ink, opacity: 0.22, transform: 'translateZ(-16px)' }} />
      <div
        style={{
          ...face,
          background: l.wash + 'E6',
          border: `3px solid ${l.ink}55`,
          boxShadow: `0 0 0 ${4 * glow}px ${l.ink}66, 0 0 ${90 * glow}px ${l.ink}55`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Along the left edge, which stays in view under the layer above */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            bottom: 56,
            transformOrigin: 'left bottom',
            transform: 'rotate(-90deg) translateY(100%)',
            fontFamily: F.body,
            fontWeight: 700,
            fontSize: 46,
            letterSpacing: 10,
            color: l.ink,
            whiteSpace: 'nowrap',
            opacity: label,
          }}
        >
          {l.name.toUpperCase()}
        </div>
        {children}
      </div>
    </div>
  );
}

const SHIELD = PARTS.shield;

/** The knowledge graph of bookshelf, its references drawing in, the guard at its centre */
const NODES: [string, string, number, number][] = [
  ['Product/Goal', 'Readers find a book fast', 330, 220],
  ['Product/Feature', 'Book catalogue', 690, 210],
  ['Governance/DesignDoc', 'Bookshelf design', 330, 620],
  ['Architecture/Component', 'Book store', 720, 560],
  ['Data/Schema', 'Book', 450, 830],
  ['Testing/TestSuite', 'Catalogue checks', 740, 830],
];
const EDGES: [number, number][] = [
  [0, 1],
  [2, 1],
  [2, 0],
  [1, 3],
  [3, 4],
  [5, 1],
  [2, 4],
];
const GUARD = { x: 480, y: 500 };

function Graph({ frame, pulse }: { frame: number; pulse: number }) {
  return (
    <>
      <svg width={P} height={P} style={{ position: 'absolute', inset: 0 }}>
        {EDGES.map(([a, b], i) => {
          const [, , x1, y1] = NODES[a]!;
          const [, , x2, y2] = NODES[b]!;
          const t = ramp(frame, UNDERSTAND + 34 + i * 4, 18);
          return (
            <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} pathLength={1} stroke={C.warn} strokeOpacity={0.55} strokeWidth={4} strokeDasharray="1" strokeDashoffset={1 - t} fill="none" />
          );
        })}
      </svg>
      {NODES.map(([type, title, x, y], i) => {
        const t = pop(frame, UNDERSTAND + 16 + i * 4, true);
        const d = domainOf(type);
        return (
          <div
            key={title}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(-50%,-50%) scale(${t})`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: C.surface,
              border: `2px solid ${d.color}55`,
              borderRadius: 18,
              padding: '12px 20px 12px 12px',
              boxShadow: '0 6px 16px rgba(30,41,59,.12)',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 22, background: d.color + '29', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Glyph path={d.path} size={26} color={d.color} stroke />
            </div>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 36, color: C.ink }}>{title}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: GUARD.x, top: GUARD.y, transform: `translate(-50%,-50%) scale(${pop(frame, UNDERSTAND + 10, true)})` }}>
        <div
          style={{
            position: 'absolute',
            left: -90,
            top: -90,
            width: 180,
            height: 180,
            borderRadius: 90,
            border: `4px solid ${C.warn}`,
            opacity: 0.6 * (1 - pulse),
            transform: `scale(${0.6 + 0.9 * pulse})`,
          }}
        />
        <div
          style={{
            width: 112,
            height: 112,
            marginLeft: -56,
            marginTop: -56,
            borderRadius: 56,
            background: C.surface,
            border: `4px solid ${C.warn}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 ${30 + 40 * pulse}px ${C.warn}66`,
          }}
        >
          <Glyph path={SHIELD} size={60} color={C.warn} stroke />
        </div>
      </div>
    </>
  );
}

/** The runs working on the approved goal */
const RUNS: [string, string, number][] = [
  ['Planned', 'search by author', 0],
  ['Done', 'built and tested', 8],
  ['Checked', 'all 14 checks pass', 16],
];
const RUN_Y = (i: number) => 230 + i * 210;

function Runs({ frame }: { frame: number }) {
  return (
    <>
      {RUNS.map(([name, what, delay], i) => {
        const shown = pop(frame, IMPLEMENT + 12 + i * 6);
        const fill = ramp(frame, IMPLEMENT + 24 + delay, 30, Easing.inOut(Easing.quad));
        const done = fill >= 1;
        return (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: 90,
              top: RUN_Y(i),
              width: 760,
              opacity: shown,
              transform: `translateX(${-40 * (1 - shown)}px)`,
              background: C.surface,
              borderRadius: 24,
              border: `2px solid ${C.ok}55`,
              padding: '22px 28px',
              boxSizing: 'border-box',
              boxShadow: '0 6px 16px rgba(30,41,59,.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
              <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 42, color: C.ink }}>{name}</span>
              <span style={{ fontFamily: F.mono, fontSize: 28, color: C.muted }}>{what}</span>
              <div style={{ flex: 1 }} />
              <div style={{ transform: `scale(${done ? pop(frame, IMPLEMENT + 54 + delay, true) : 0})` }}>
                <Glyph path="M5 12l5 5L20 7" size={40} color={C.ok} stroke />
              </div>
            </div>
            <div style={{ height: 14, borderRadius: 7, background: C.washOk }}>
              <div style={{ height: 14, borderRadius: 7, width: `${fill * 100}%`, background: C.ok }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

/** The work of the runs rising through the guard into the feed */
function Rising({ frame }: { frame: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const t = ramp(frame, RISE + i * 3, 30, Easing.inOut(Easing.cubic));
        if (t <= 0 || t >= 1) return null;
        const sx = 820;
        const sy = RUN_Y(i % 3) + 50;
        // Through the guard halfway, then into the feed's card on the phone
        const x = t < 0.5 ? mix(t * 2, sx, GUARD.x) : mix((t - 0.5) * 2, GUARD.x, P / 2);
        const y = t < 0.5 ? mix(t * 2, sy, GUARD.y) : mix((t - 0.5) * 2, GUARD.y, P / 2 - 40);
        const z = mix(t, -2 * GAP, 30);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - 36,
              top: y - 28,
              width: 72,
              height: 56,
              borderRadius: 12,
              background: t < 0.5 ? C.ok : C.warn,
              border: '4px solid #fff',
              boxShadow: `0 0 40px ${t < 0.5 ? C.ok : C.warn}`,
              transform: `translateZ(${z}px)`,
            }}
          />
        );
      })}
    </>
  );
}

/** The feed on the phone: cards landing, the top one approved, the delivered one arriving */
function Feed({ frame }: { frame: number }) {
  const landed = INCOMING.filter((_, i) => frame >= LAND(i) + FLY).length;
  const flying = INCOMING.findIndex((_, i) => frame >= LAND(i) && frame < LAND(i) + FLY);
  const rankOut = ramp(frame, 90, 10);

  // The approval: the finger drags the top card right, it flies off, the next comes forward
  const drag = ramp(frame, APPROVE.drag, APPROVE.release - APPROVE.drag, Easing.inOut(Easing.quad)) * 330;
  const away = ramp(frame, APPROVE.release, 18, Easing.in(Easing.cubic));
  const dx = drag + away * 700;
  const approved = frame >= APPROVE.release + 18;
  const forward = pop(frame, APPROVE.release + 4);
  const arrived = pop(frame, ARRIVE, true);

  const top = (i: number, style?: CSSProperties) => {
    const e = INCOMING[i]!;
    return (
      <FeedCard key={e.title} e={e} style={style}>
        <div
          style={{
            position: 'absolute',
            left: -12,
            top: -14,
            background: C.accent,
            color: '#fff',
            fontFamily: F.body,
            fontWeight: 700,
            fontSize: 16,
            borderRadius: 999,
            padding: '4px 12px',
            opacity: 1 - rankOut,
            transform: `scale(${1 - rankOut})`,
          }}
        >
          #{e.rank}
        </div>
      </FeedCard>
    );
  };

  const cards: ReactNode[] = [];
  const queued = landed - (approved ? 1 : 0) + (frame >= ARRIVE ? 1 : 0);
  if (queued > 2 || (flying >= 0 && landed >= 2)) cards.push(<Behind key="b2" depth={2} />);
  if (queued > 1 || (flying >= 0 && landed >= 1)) cards.push(<Behind key="b1" depth={1} />);
  if (frame >= ARRIVE) {
    // The delivered card drops on top of the feed
    cards.push(
      <FeedCard
        key="delivered"
        e={DELIVERED}
        style={{ transform: `translateY(${-60 * (1 - arrived)}px) scale(${mix(arrived, 1.12, 1)})`, opacity: Math.min(1, arrived * 2), boxShadow: `0 0 ${50 * (1 - ramp(frame, ARRIVE + 20, 30))}px ${C.ok}` }}
      />,
    );
  } else if (approved) {
    cards.push(top(2, { transformOrigin: 'top', transform: `translateY(${-8 * (1 - forward)}px) scale(${mix(forward, 0.965, 1)})` }));
  } else if (landed > 0) {
    const i = landed - 1;
    const swiped = i === 3;
    cards.push(
      top(i, swiped ? { transform: `translateX(${dx}px) rotate(${Math.min(10, dx * 0.03)}deg)`, opacity: 1 - away } : undefined),
    );
    if (swiped && drag > 0) {
      cards.push(<Stamp key="stamp" kind="ok" label="APPROVE" style={{ left: SLOT.x + 22 + dx, top: SLOT.y + 150, opacity: Math.min(1, drag / 120) * (1 - away) }} />);
    }
  }
  if (flying >= 0) {
    // Flying in from its project's chip, over an arc
    const e = INCOMING[flying]!;
    const t = ramp(frame, LAND(flying), FLY, Easing.out(Easing.cubic));
    const from = { x: e.chip[0] - SCREEN_ORIGIN.x - SLOT.x - SLOT.w / 2, y: e.chip[1] - SCREEN_ORIGIN.y - SLOT.y - SLOT.h / 2 };
    cards.push(
      top(flying, {
        transform: `translate(${from.x * (1 - t)}px, ${from.y * (1 - t) - 90 * Math.sin(Math.PI * t)}px) scale(${mix(t, 0.2, 1)}) rotate(${(1 - t) * (e.chip[0] > STAGE.x ? 12 : -12)}deg)`,
        opacity: Math.min(1, t * 3),
      }),
    );
  }
  return (
    <>
      <Counters unverified={20 + landed - (approved ? 1 : 0) + (frame >= ARRIVE ? 1 : 0)} verified={12 + (approved ? 1 : 0)} bump={approved ? 1 - ramp(frame, APPROVE.release + 18, 12) : 0} />
      {cards}
    </>
  );
}

/** Where the phone's screen starts on the frame while the stack is flat */
const SCREEN_ORIGIN = { x: STAGE.x - PHONE.w / 2 + 14, y: STAGE.y - PHONE.h / 2 + 14 };

function Chips({ frame }: { frame: number }) {
  const out = ramp(frame, 84, 12);
  return (
    <>
      {INCOMING.map((e, i) => {
        const t = pop(frame, 2 + i * 4, true);
        const sent = 1 + 0.15 * Math.sin(Math.PI * ramp(frame, LAND(i), 10));
        return (
          <div
            key={e.project.name}
            style={{
              position: 'absolute',
              left: e.chip[0],
              top: e.chip[1],
              transform: `translate(-50%,-50%) scale(${t * sent * (1 - out)})`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: C.surface,
              borderRadius: 999,
              padding: '12px 22px 12px 12px',
              boxShadow: '0 10px 30px rgba(30,41,59,.14)',
              border: `1px solid ${C.line}`,
            }}
          >
            <ProjectMark project={e.project} size={36} />
            <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 26, color: C.ink }}>{e.project.name}</span>
          </div>
        );
      })}
    </>
  );
}

/** The narration: a line per beat */
export const LAYERS_CUES: Cue[] = [
  { at: 4, hold: 88, text: 'Everything that needs your decision, from every project, in one feed, most important first.' },
  { at: 100, hold: 180, text: 'Nothing moves forward without your yes.' },
  { at: 196, hold: 284, text: 'Behind it, Momentum understands each project, and keeps it consistent.' },
  { at: 296, hold: 368, text: 'AI does the work: planned, done and checked.' },
  { at: 384, hold: 440, text: 'What it finishes comes back to you, ready to read.' },
  { at: 455, hold: 486, text: 'Your attention, where it pays.' },
];
const DWELLS = voiceDwells('Layers', LAYERS_CUES, LAYERS_FRAMES);
export const LAYERS_LENGTH = dwelt(LAYERS_FRAMES, DWELLS);

export function Layers() {
  const frame = dwell(useCurrentFrame(), DWELLS);
  const tilt = ramp(frame, TILT, 56, Easing.bezier(0.45, 0, 0.2, 1));
  const drift = ramp(frame, TILT, LAYERS_FRAMES - TILT, Easing.linear);
  const rx = 58 * tilt;
  const rz = -26 * tilt + 7 * drift;
  // The camera: the whole stack, then close on each layer as it is told, then the whole stack again for the work
  // rising through it; `level` is the layer at the centre of the frame, 0 the top
  const camera = (values: number[]) =>
    interpolate(frame, [TILT, TILT + 56, UNDERSTAND + 26, UNDERSTAND + 56, IMPLEMENT - 4, IMPLEMENT + 26, RISE - 14, RISE + 16], values, {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
  const level = camera([0, 0.9, 0.9, 1, 1, 2, 2, 0.9]);
  const scale = camera([1, 0.6, 0.6, 0.95, 0.95, 0.95, 0.95, 0.6]);
  // A layer lies 407 px a unit of scale below the one above it on screen, at this tilt
  const dy = -25 * tilt - 407 * scale * level;
  const glow = ramp(frame, CLOSE, 24);
  const pulse = (frame - (UNDERSTAND + 10)) % 30 / 30;
  const guardHit = ramp(frame, RISE + 12, 6) * (1 - ramp(frame, RISE + 24, 10));

  // The finger approving the top card, while the stack is still flat
  const fx = STAGE.x + 20 + ramp(frame, APPROVE.drag, APPROVE.release - APPROVE.drag, Easing.inOut(Easing.quad)) * 330;
  const fy = STAGE.y + 40 - 46 * Math.sin((Math.PI * (fx - STAGE.x - 20)) / 330);
  const fingerIn = ramp(frame, APPROVE.show + 14, 10) * (1 - ramp(frame, APPROVE.release + 2, 10));
  const pressed = ramp(frame, APPROVE.press, 4) * (1 - ramp(frame, APPROVE.release, 4));

  return (
    <AbsoluteFill>
      <Voice scene="Layers" cues={LAYERS_CUES} dwells={DWELLS} />
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: `${STAGE.x}px ${STAGE.y}px` }}>
        <div
          style={{
            position: 'absolute',
            left: STAGE.x - P / 2,
            top: STAGE.y - P / 2,
            width: P,
            height: P,
            transformStyle: 'preserve-3d',
            transform: `translateY(${dy}px) scale(${scale}) rotateX(${rx}deg) rotateZ(${rz}deg)`,
          }}
        >
          <Plane layer="implementation" z={-2 * GAP} opacity={ramp(frame, IMPLEMENT, 20)} glow={glow}>
            <Runs frame={frame} />
          </Plane>
          <Plane layer="understanding" z={-GAP - 140 * (1 - ramp(frame, UNDERSTAND, 26, Easing.out(Easing.cubic)))} opacity={ramp(frame, UNDERSTAND, 16)} glow={glow}>
            <Graph frame={frame} pulse={frame >= RISE ? guardHit : Math.max(0, pulse)} />
          </Plane>
          {/* Its name leaves before the camera, down on the runs, pushes it past the frame's top */}
          <Plane layer="attention" z={0} opacity={ramp(frame, APPROVE.show, 18)} glow={glow} label={1 - Math.min(1, Math.max(0, (level - 1.2) * 3))} />
          <Rising frame={frame} />
          <Phone style={{ left: (P - PHONE.w) / 2, top: (P - PHONE.h) / 2, transform: 'translateZ(8px)', boxShadow: tilt > 0 ? `0 ${40 * (1 - tilt)}px ${80 * (1 - tilt) + 20}px rgba(30,41,59,.3)` : undefined }}>
            <Feed frame={frame} />
          </Phone>
        </div>
      </AbsoluteFill>
      <Chips frame={frame} />
      <Finger x={fx} y={fy} opacity={fingerIn} pressed={pressed} />

      <Headline frame={frame} from={0} to={106} tag="One feed" color={C.accent} text="Every project. One feed." sub="Ranked by what matters most." />
      <Headline frame={frame} from={106} to={192} tag="Attention" color={LAYERS.attention.ink} text='Nothing moves forward without your yes.' />
      <Headline frame={frame} from={194} to={302} tag="Understanding" color={LAYERS.understanding.ink} text="Every project, understood." sub="A knowledge graph, checked on every change." />
      <Headline frame={frame} from={304} to={CLOSE} tag="Implementation" color={LAYERS.implementation.ink} text="Work arrives whole." sub="AI plans it, does it and checks it." />
      <Closing frame={frame} />
    </AbsoluteFill>
  );
}

function Closing({ frame }: { frame: number }) {
  if (frame < CLOSE) return null;
  const logo = pop(frame, CLOSE + 2);
  const line = ramp(frame, CLOSE + 14, 14, Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: 120, top: 400 }}>
      <div style={{ opacity: logo, transform: `translateY(${30 * (1 - logo)}px)` }}>
        <Logo width={560} />
      </div>
      <div style={{ fontFamily: F.head, fontSize: 52, color: C.ink, marginTop: 36, opacity: line, transform: `translateY(${20 * (1 - line)}px)` }}>
        Your attention, where it pays.
      </div>
    </div>
  );
}
