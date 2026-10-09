// Scene 3, after the deck's "How everything works together": the loop every project runs, as a carousel on the floor
// around the phone. Each part comes to the front in turn; the feed receives the card, you approve it; then every
// project's loop spins at once.
import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, ProjectMark, Stamp, type Entity } from '../kit/app.tsx';
import { Backdrop, TopHeadline } from '../kit/stage.tsx';
import { C, DOMAINS, F, ICONS, LAYERS, PARTS, type Layer } from '../kit/theme.ts';
import { dwelt, mix, pop, ramp, useAmbientFrame, useSceneFrame } from '../kit/motion.ts';
import { type Cue, Voice, voiceDwells } from '../kit/voice.tsx';

export const LOOP_FRAMES = 790;

const STATIONS: { name: string; sub: string; layer: Layer; glyph: string; filled?: boolean }[] = [
  { name: 'Start', sub: 'a schedule, an event, or you', layer: 'implementation', glyph: ICONS.clock, filled: true },
  { name: 'Work', sub: 'done by AI', layer: 'implementation', glyph: PARTS.terminal },
  { name: 'Results', sub: 'documents and changes', layer: 'implementation', glyph: DOMAINS.Code!.path },
  { name: 'Write-up', sub: 'into cards you can read', layer: 'implementation', glyph: PARTS.sparkles },
  { name: 'Check', sub: 'before it counts', layer: 'understanding', glyph: PARTS.shield },
  { name: 'History', sub: 'everything recorded', layer: 'understanding', glyph: ICONS.commit, filled: true },
  { name: 'Your feed', sub: 'most important first', layer: 'attention', glyph: ICONS.feed, filled: true },
  { name: 'You', sub: 'approve · send back · ask', layer: 'attention', glyph: ICONS.user, filled: true },
];
const N = STATIONS.length;
const STEP = 360 / N;

// The floor: an ellipse around the phone
const RING = { x: 960, y: 770, rx: 720, ry: 125 };
const PHONE_AT = { x: 960, y: 470, scale: 0.6 };

// Beats: one part at the front every BEAT frames, then every project at once
// The first part rests at the front while the loop is introduced, then the ring starts to turn
const OPEN = 18;
const START = OPEN + 110;
const BEAT = 60;
// You rest at the front a while longer: your decision is where the loop ends
const YOU_REST = 30;
const SPIN = START + N * BEAT + YOU_REST;

const CARD: Entity = {
  project: { name: 'bookshelf', color: '#1D6FD6' },
  type: 'Product/Feature',
  title: 'Search by author or title',
  desc: 'Readers can now find a book by author or title.',
  bullets: ['Planned, done and checked', 'Ready for your review'],
  state: 'unverified',
};
const MORE: Entity[] = [
  { project: { name: 'handbook', color: '#7C3AED' }, type: 'Knowledge/HowToGuide', title: 'Onboarding, week one', desc: 'What a new joiner does, day by day.', bullets: ['Laptop on day one', 'A buddy for the first month'], state: 'unverified' },
  { project: { name: 'to-do app', color: '#C2410C' }, type: 'Product/Feature', title: 'Due dates', desc: 'A to-do can be due on a day; overdue ones come first.', bullets: ['todo due <id> 2026-11-01'], state: 'unverified' },
  { project: { name: 'notes', color: '#0F766E' }, type: 'Testing/TestSuite', title: 'Sharing checks', desc: 'Every way a note is shared, tried out.', bullets: ['31 checks, all passing'], state: 'unverified' },
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
    // Turning from part to part: each comes to rest at the front, so a line about it can be finished there
    const p = (Math.min(f, START + (N - 1) * BEAT) + Math.max(0, f - START - (N - 1) * BEAT - YOU_REST) - START) / BEAT;
    return p - Math.sin(2 * Math.PI * p) / (2 * Math.PI);
  }
  // Every project's loop: picking up speed, never a blur
  const t = f - SPIN;
  return N + t * t * 0.0003 + t * 0.06;
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
  const active = Math.max(0, 1 - Math.min(d, N - d) * 1.8) * (1 - ramp(f, SPIN, 10));
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
      {/* Names at the back of the ring would crowd the ones in front: they show from the sides forward */}
      <div style={{ marginTop: 14, fontFamily: F.head, fontWeight: 700, fontSize: 30, color: C.ink, whiteSpace: 'nowrap', opacity: ramp(depth, 0.3, 0.25) }}>{s.name}</div>
      <div style={{ marginTop: 4, fontFamily: F.body, fontSize: 24, color: l.ink, whiteSpace: 'nowrap', opacity: active }}>{s.sub}</div>
    </div>
  );
}

/** The floor's ring, its dashes flowing the way the loop turns, and the glow where the work is now */
function Floor({ f, real }: { f: number; real: number }) {
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
      <ellipse cx={RING.x} cy={RING.y} rx={RING.rx} ry={RING.ry} fill="none" stroke={C.accent} strokeWidth={4} strokeDasharray="14 22" strokeDashoffset={-real * 3} opacity={0.7} />
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
        const a = ((90 + i * 90 - t * (2 + t * 0.012) - 32 * Math.sin(t / 11 + i)) * Math.PI) / 180;
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

/** The steps of the job on its way to you, as the phone shows them: one per part of the ring before the feed */
const STEPS = STATIONS.slice(0, 6);

/** The phone while the job goes round: its steps ticking off as each part of the ring comes to the front */
function Job({ at, real, style }: { at: number; real: number; style: CSSProperties }) {
  const current = Math.min(STEPS.length, Math.max(0, Math.round(at)));
  return (
    <div style={{ position: 'absolute', left: 22, right: 22, top: 104, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.body, fontWeight: 700, fontSize: 20, color: C.muted }}>
        <ProjectMark project={CARD.project} size={26} />
        {CARD.project.name}
      </div>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 30, lineHeight: 1.15, color: C.ink, margin: '10px 0 22px' }}>{CARD.title}</div>
      {STEPS.map((step, k) => {
        const l = LAYERS[step.layer];
        const done = k < current;
        const now = k === current;
        return (
          <div key={step.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', marginBottom: 8, borderRadius: 16, background: now ? l.wash : 'transparent', border: `2px solid ${now ? l.ink : 'transparent'}` }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? C.ok : now ? l.ink : C.card, boxShadow: now ? `0 0 ${10 + 8 * Math.sin(real / 6)}px ${l.ink}` : 'none' }}>
              {done ? <Glyph path="M5 12l5 5L20 7" size={26} color="#fff" stroke /> : <Glyph path={step.glyph} size={24} color={now ? '#fff' : C.muted} stroke={!step.filled} />}
            </div>
            <div>
              <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 23, color: done || now ? C.ink : C.muted }}>{step.name}</div>
              <div style={{ fontFamily: F.body, fontSize: 17, color: C.muted }}>{step.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The narration: a line per beat */
export const LOOP_CUES: Cue[] = [
  { at: OPEN, hold: START - 10, text: 'Work starts on its own, on a schedule, or when something happens.' },
  { at: START + BEAT, hold: START + 3 * BEAT + 20, text: 'It gets done, and written up for you.' },
  { at: START + 4 * BEAT, hold: START + 5 * BEAT + 20, text: 'Every change is checked before it counts.' },
  { at: START + 6 * BEAT, hold: START + 7 * BEAT + 20, text: 'Then it reaches you, and you decide.' },
  { at: SPIN, hold: LOOP_FRAMES - 30, text: 'For every project, all at once.' },
];
const DWELLS = voiceDwells('Loop', LOOP_CUES, LOOP_FRAMES);
export const LOOP_LENGTH = dwelt(LOOP_FRAMES, DWELLS);

export function Loop() {
  const f = useSceneFrame(DWELLS);
  const real = useAmbientFrame();
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
  // The phone follows the job: its steps while the ring turns, the feed once the job reaches it
  const toFeed = ramp(f, feedBeat - 16, 14);

  return (
    <AbsoluteFill>
      <Voice scene="Loop" cues={LOOP_CUES} dwells={DWELLS} />
      <Backdrop />
      <Floor f={f} real={real} />
      <Beam f={f} at={at} real={real} />
      {STATIONS.map((_, i) => (
        <Station key={i} i={i} at={at} f={f} />
      ))}
      <Tokens f={f} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
        <Phone
          tab={toFeed < 0.5 ? 'chat' : 'feed'}
          style={{
            left: PHONE_AT.x - PHONE.w / 2,
            top: PHONE_AT.y - PHONE.h / 2,
            transform: `scale(${PHONE_AT.scale * mix(enter, 0.9, 1)}) translateY(${-6 * Math.sin(real / 18)}px)`,
            opacity: enter,
          }}
        >
          {toFeed < 1 ? <Job at={at} real={real} style={{ opacity: 1 - toFeed }} /> : null}
          {toFeed > 0 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: toFeed }}>
              <Counters unverified={22 + (f >= feedBeat ? 1 : 0) + pouring.length - (away >= 1 ? 1 : 0)} verified={12 + (away >= 1 ? 1 : 0)} bump={away >= 1 ? 1 - ramp(f, youBeat + 30, 12) : 0} />
              <Behind depth={2} />
              <Behind depth={1} />
              {last < 0 ? <FeedCard e={WAITING} /> : null}
            </div>
          ) : null}
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
        <TopHeadline frame={f} from={2} to={SPIN - 2} tag="How it works" color={C.accent} text="One loop per project." sub="From the first step to your decision, on its own." />
        <TopHeadline frame={f} from={SPIN + 2} to={LOOP_FRAMES} tag="Every project" color={C.accent} text="All of them, at once." sub="And whatever you ask for starts right away." />
      </div>
    </AbsoluteFill>
  );
}

/** A beam from the part at the front up to the phone, in that part's layer colour: what reaches you, and from where */
function Beam({ f, at, real }: { f: number; at: number; real: number }) {
  if (f < OPEN || f >= SPIN) return null;
  const k = ((Math.round(at) % N) + N) % N;
  const settled = 1 - Math.min(1, Math.abs(at - Math.round(at)) * 4);
  const color = LAYERS[STATIONS[k]!.layer].ink;
  const top = PHONE_AT.y + (PHONE.h / 2) * PHONE_AT.scale - 10;
  const bottom = RING.y + RING.ry - 60;
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: settled * ramp(f, OPEN, 10), zIndex: 55 }}>
      <defs>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.55} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path d={`M ${RING.x - 46} ${bottom} L ${PHONE_AT.x - 120} ${top} L ${PHONE_AT.x + 120} ${top} L ${RING.x + 46} ${bottom} Z`} fill="url(#beam)" />
      {[0, 1, 2].map((i) => {
        const t = (real / 24 + i / 3) % 1;
        return <circle key={i} cx={RING.x} cy={mix(t, bottom, top)} r={7} fill={color} opacity={0.8 * (1 - t)} />;
      })}
    </svg>
  );
}
