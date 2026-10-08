// Scene 3, after the deck's "How everything works together": the loop every project runs, as a carousel on the floor
// around the phone. Each part comes to the front in turn; the feed receives the card, you approve it; then every
// project's loop spins at once.
import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, Stamp, type Entity } from '../kit/app.tsx';
import { Backdrop, Headline } from '../kit/stage.tsx';
import { C, DOMAINS, F, ICONS, LAYERS, PARTS, type Layer } from '../kit/theme.ts';
import { mix, pop, ramp } from '../kit/motion.ts';

export const LOOP_FRAMES = 450;

const STATIONS: { name: string; sub: string; layer: Layer; glyph: string; filled?: boolean }[] = [
  { name: 'Triggers', sub: 'schedule · event · on demand', layer: 'implementation', glyph: ICONS.clock, filled: true },
  { name: 'Runs', sub: 'own checkout of the main line', layer: 'implementation', glyph: PARTS.terminal },
  { name: 'Work', sub: 'entities and artifacts', layer: 'implementation', glyph: DOMAINS.Code!.path },
  { name: 'Summarization', sub: 'artifacts into cards', layer: 'implementation', glyph: PARTS.sparkles },
  { name: 'Consistency guard', sub: 'validated, then landed', layer: 'understanding', glyph: PARTS.shield },
  { name: 'Main line', sub: 'a commit per run', layer: 'understanding', glyph: ICONS.commit, filled: true },
  { name: 'Attention feed', sub: 'ranked, unverified first', layer: 'attention', glyph: ICONS.feed, filled: true },
  { name: 'You', sub: 'approve · send back · chat', layer: 'attention', glyph: ICONS.user, filled: true },
];
const N = STATIONS.length;
const STEP = 360 / N;

// The floor: an ellipse around the phone
const RING = { x: 1270, y: 760, rx: 540, ry: 130 };
const PHONE_AT = { x: 1270, y: 380, scale: 0.68 };

// Beats: one part at the front every BEAT frames, then every project at once
const START = 18;
const BEAT = 36;
const MOVE = 14;
const SPIN = START + N * BEAT;

const CARD: Entity = {
  project: { name: 'bookshelf-api', color: '#1D6FD6' },
  type: 'Architecture/Api',
  title: 'Books API: search by author or title',
  desc: 'GET /books?q= finds a book in one request.',
  bullets: ['Planned, implemented and validated', 'Landed as one commit on the main line'],
  state: 'unverified',
};
const MORE: Entity[] = [
  { project: { name: 'handbook', color: '#7C3AED' }, type: 'Knowledge/HowToGuide', title: 'Onboarding, week one', desc: 'What a new joiner does, day by day.', bullets: ['Laptop on day one', 'A buddy for the first month'], state: 'unverified' },
  { project: { name: 'todo-cli', color: '#C2410C' }, type: 'Product/Feature', title: 'Due dates', desc: 'A to-do can be due on a day; overdue ones come first.', bullets: ['todo due <id> 2026-11-01'], state: 'unverified' },
  { project: { name: 'notes-api', color: '#0F766E' }, type: 'Testing/TestSuite', title: 'Notes API tests', desc: 'Every route, valid and invalid input.', bullets: ['31 tests, all passing'], state: 'unverified' },
];
const WAITING: Entity = {
  project: { name: 'handbook', color: '#7C3AED' },
  type: 'Governance/Policy',
  title: 'Remote work policy',
  desc: 'Up to three remote days a week; Tuesday is a studio day for all.',
  bullets: ['Core hours 10:00 to 16:00', 'Messages answered within two hours'],
  state: 'unverified',
};
const PROJECT_COLORS = ['#1D6FD6', '#7C3AED', '#C2410C', '#0F766E'];

/** Which part is at the front, as a continuous index: whole numbers while one rests there */
function front(f: number): number {
  if (f < START) return 0;
  if (f < SPIN) {
    const p = (f - START) / BEAT;
    const k = Math.floor(p);
    return k + ramp((p - k) * BEAT, BEAT - MOVE, MOVE, Easing.inOut(Easing.cubic));
  }
  // Every project's loop: spinning faster and faster
  const t = f - SPIN;
  return N + t * t * 0.0016 + t * 0.03;
}

function Station({ i, at, f }: { i: number; at: number; f: number }) {
  const s = STATIONS[i]!;
  const l = LAYERS[s.layer];
  // The front of the floor is straight down, at 90 degrees
  const angle = ((90 + (i - at) * STEP) * Math.PI) / 180;
  const x = RING.x + RING.rx * Math.cos(angle);
  const y = RING.y + RING.ry * Math.sin(angle);
  const depth = (Math.sin(angle) + 1) / 2;
  // How close it is to the front, round the ring; nothing is singled out while every loop spins
  const d = (((i - at) % N) + N) % N;
  const active = Math.max(0, 1 - Math.min(d, N - d) * 2.5) * (1 - ramp(f, SPIN, 10));
  const shown = pop(f, 4 + i * 2, true);
  const scale = (0.62 + 0.38 * depth + 0.3 * active) * shown;
  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    transform: `translate(-50%, -50%) scale(${scale})`,
    zIndex: Math.round(depth * 100),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    opacity: 0.45 + 0.55 * depth,
    filter: `blur(${(1 - depth) * 2}px)`,
  };
  return (
    <div style={style}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          background: active > 0.5 ? l.ink : l.wash,
          border: `5px solid ${l.ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 ${10 + 20 * active}px ${30 + 40 * active}px ${active > 0.5 ? l.ink + '88' : 'rgba(30,41,59,.18)'}`,
        }}
      >
        <Glyph path={s.glyph} size={48} color={active > 0.5 ? '#fff' : l.ink} stroke={!s.filled} />
      </div>
      <div style={{ marginTop: 14, fontFamily: F.head, fontWeight: 700, fontSize: 30, color: C.ink, whiteSpace: 'nowrap' }}>{s.name}</div>
      <div style={{ marginTop: 4, fontFamily: F.body, fontSize: 24, color: l.ink, whiteSpace: 'nowrap', opacity: active }}>{s.sub}</div>
    </div>
  );
}

/** The floor's ring, its dashes flowing the way the loop turns, and the glow where the work is now */
function Floor({ f }: { f: number }) {
  const shown = ramp(f, 0, 20);
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: shown }}>
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={RING.x} cy={RING.y} rx={RING.rx + 80} ry={RING.ry + 40} fill={C.card} opacity={0.6} />
      <ellipse cx={RING.x} cy={RING.y} rx={RING.rx} ry={RING.ry} fill="none" stroke={C.line} strokeWidth={14} />
      <ellipse cx={RING.x} cy={RING.y} rx={RING.rx} ry={RING.ry} fill="none" stroke={C.accent} strokeWidth={4} strokeDasharray="14 22" strokeDashoffset={-f * 3} opacity={0.7} />
      <ellipse cx={RING.x} cy={RING.y + RING.ry} rx={150} ry={46} fill="url(#glow)" />
    </svg>
  );
}

/** Every project's loop at once: one token per project racing round the floor */
function Tokens({ f }: { f: number }) {
  if (f < SPIN) return null;
  const t = f - SPIN;
  return (
    <>
      {PROJECT_COLORS.map((color, i) => {
        const a = ((90 + i * 90 - t * (4 + t * 0.06)) * Math.PI) / 180;
        const depth = (Math.sin(a) + 1) / 2;
        return (
          <div
            key={color}
            style={{
              position: 'absolute',
              left: RING.x + RING.rx * Math.cos(a) - 14,
              top: RING.y + RING.ry * Math.sin(a) - 14,
              width: 28,
              height: 28,
              borderRadius: 14,
              background: color,
              border: '4px solid #fff',
              boxShadow: `0 0 24px ${color}`,
              opacity: pop(f, SPIN + i * 4),
              zIndex: Math.round(depth * 100) + 1,
            }}
          />
        );
      })}
    </>
  );
}

export function Loop() {
  const f = useCurrentFrame();
  const at = front(f);
  // The phone's feed: the card lands when the feed comes to the front, you approve it next, then cards pour in
  const feedBeat = START + 6 * BEAT;
  const youBeat = START + 7 * BEAT;
  const landed = pop(f, feedBeat, true);
  const stamp = ramp(f, youBeat + 4, 8);
  const away = ramp(f, youBeat + 16, 14, Easing.in(Easing.cubic));
  const enter = pop(f, 0);
  const pouring = MORE.filter((_, i) => f >= SPIN + 20 + i * 22);
  const last = pouring.length - 1;

  return (
    <AbsoluteFill>
      <Backdrop />
      <Floor f={f} />
      {STATIONS.map((_, i) => (
        <Station key={i} i={i} at={at} f={f} />
      ))}
      <Tokens f={f} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
        <Phone
          style={{
            left: PHONE_AT.x - PHONE.w / 2,
            top: PHONE_AT.y - PHONE.h / 2,
            transform: `scale(${PHONE_AT.scale * mix(enter, 0.9, 1)}) translateY(${-6 * Math.sin(f / 18)}px)`,
            opacity: enter,
          }}
        >
          <Counters unverified={22 + (f >= feedBeat ? 1 : 0) + pouring.length - (away >= 1 ? 1 : 0)} verified={12 + (away >= 1 ? 1 : 0)} bump={away >= 1 ? 1 - ramp(f, youBeat + 30, 12) : 0} />
          <Behind depth={2} />
          <Behind depth={1} />
          {last < 0 ? <FeedCard e={WAITING} /> : null}
          {f >= feedBeat && away < 1 ? (
            <FeedCard e={CARD} style={{ transform: `translateY(${-80 * (1 - landed)}px) translateX(${away * 520}px) rotate(${away * 12}deg)`, opacity: Math.min(1, landed * 2) * (1 - away) }}>
              <Stamp kind="ok" label="APPROVE" style={{ left: 22, top: 200, opacity: stamp }} />
            </FeedCard>
          ) : null}
          {last >= 0 ? (
            <FeedCard key={last} e={MORE[last]!} style={{ transform: `translateY(${-80 * (1 - pop(f, SPIN + 20 + last * 22, true))}px)` }} />
          ) : null}
        </Phone>
      </div>

      <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
        <Headline frame={f} from={2} to={SPIN - 2} tag="How it works" color={C.accent} text="One loop per project." sub="From a trigger to your feed, on its own." />
        <Headline frame={f} from={SPIN + 2} to={LOOP_FRAMES} tag="Every project" color={C.accent} text="All of them, at once." sub="Runs you start go at once, alongside." />
      </div>
    </AbsoluteFill>
  );
}
