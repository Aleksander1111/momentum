// Scene 7, after the deck's "Summarization" and "Graph completeness": a run stops and the files it touched become
// one card in the feed; then the phone's Settings measure how complete the project's graph is, question by question
// and area by area, until nothing is missing.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, SLOT, StateIcon, type Entity } from '../kit/app.tsx';
import { Backdrop, Headline } from '../kit/stage.tsx';
import { C, F, PARTS } from '../kit/theme.ts';
import { mix, pop, ramp } from '../kit/motion.ts';

export const MEASURE_FRAMES = 420;

const PHONE_AT = { x: 1130, y: 540 };
const SCREEN0 = { x: PHONE_AT.x - PHONE.w / 2 + 14, y: PHONE_AT.y - PHONE.h / 2 + 14 };
const RIGHT = 1640;

// Beats
const STOP = 30;
const FILES = (i: number) => STOP + 14 + i * 8;
const INTO = (i: number) => 96 + i * 6;
const CARD = 132;
const SETTINGS = 196;
const QUESTION = (i: number) => SETTINGS + 30 + i * 18;

const ARTIFACTS: [string, string][] = [
  ['src/routes/books.js', '+42'],
  ['src/store.js', '+18'],
  ['test/books.test.js', '+88'],
];

const SUMMARY: Entity = {
  project: { name: 'bookshelf-api', color: '#1D6FD6' },
  type: 'Architecture/Api',
  title: 'Books API: search by author or title',
  desc: 'GET /books?q= finds a book in one request.',
  bullets: ['src/routes/books.js, src/store.js', 'test/books.test.js: 9 new tests'],
  state: 'unverified',
};

const WAITING: Entity = {
  project: { name: 'handbook', color: '#7C3AED' },
  type: 'Governance/Policy',
  title: 'Remote work policy',
  desc: 'Up to three remote days a week; Tuesday is a studio day for all.',
  bullets: ['Core hours 10:00 to 16:00', 'Messages answered within two hours'],
  state: 'unverified',
};

/** The run stopping, its files handed to summarization, one card out */
function Pipeline({ f }: { f: number }) {
  const out = ramp(f, SETTINGS - 10, 14);
  if (out >= 1) return null;
  const run = pop(f, 4);
  const done = f >= STOP;
  const node = pop(f, 70, true);
  const glow = f >= INTO(0) && f < CARD ? 0.5 + 0.5 * Math.sin((f - INTO(0)) / 3) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out }}>
      <div
        style={{
          position: 'absolute',
          left: RIGHT,
          top: 240,
          transform: `translate(-50%, -50%) scale(${run})`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: C.surface,
          border: `3px solid ${C.ok}`,
          borderRadius: 999,
          padding: '12px 26px 12px 16px',
          fontFamily: F.body,
          fontWeight: 700,
          fontSize: 24,
          color: C.ink,
          whiteSpace: 'nowrap',
          boxShadow: '0 10px 24px rgba(30,41,59,.12)',
        }}
      >
        <Glyph path={PARTS.terminal} size={28} color={C.ok} stroke />
        Implementation run
        <div style={{ transform: `rotate(${done ? 0 : f * 9}deg)`, display: 'flex' }}>
          {done ? <Glyph path="M5 12l5 5L20 7" size={26} color={C.ok} stroke /> : <StateIcon state="updating" size={26} />}
        </div>
      </div>
      {done ? (
        <div style={{ position: 'absolute', left: RIGHT, top: 300, transform: 'translateX(-50%)', fontFamily: F.body, fontSize: 18, color: C.muted, opacity: ramp(f, STOP, 10) }}>
          Stop hook: hand over what changed
        </div>
      ) : null}
      {ARTIFACTS.map(([path, delta], i) => {
        const t = pop(f, FILES(i), true);
        const into = ramp(f, INTO(i), 18, Easing.in(Easing.cubic));
        const y = mix(into, 380 + i * 64, 700);
        return (
          <div
            key={path}
            style={{
              position: 'absolute',
              left: RIGHT,
              top: y,
              transform: `translate(-50%, -50%) scale(${t * mix(into, 1, 0.3)})`,
              opacity: 1 - ramp(f, INTO(i) + 12, 6),
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '8px 14px',
              fontFamily: F.mono,
              fontSize: 18,
              color: C.ink,
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 14px rgba(30,41,59,.1)',
            }}
          >
            <Glyph path="M6 2h8l6 6v14H6zM14 2v6h6" size={18} color={C.muted} stroke />
            {path}
            <span style={{ color: C.ok, fontWeight: 700 }}>{delta}</span>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: RIGHT,
          top: 720,
          transform: `translate(-50%, -50%) scale(${node * (1 + 0.08 * glow)})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ width: 104, height: 104, borderRadius: 52, background: C.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${20 + 50 * glow}px ${C.warn}` }}>
          <Glyph path={PARTS.sparkles} size={54} color="#fff" stroke />
        </div>
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink }}>Summarization</span>
      </div>
    </div>
  );
}

const QUESTIONS = ['What it is', 'What it is for', 'What it does', 'How it is built', 'Where the code is', 'Where it runs', 'How it is tested', 'Rules and decisions'];
const KNOWN = 5;
const AREAS: [string, number, number][] = [
  // name, share of the repository's weight, frame its last part is accounted for
  ['src', 0.38, QUESTION(4)],
  ['test', 0.24, QUESTION(6)],
  ['docs', 0.16, QUESTION(3)],
  ['examples', 0.14, QUESTION(7) + 6],
  ['root files', 0.08, QUESTION(2)],
];

function territory(f: number) {
  return AREAS.reduce((sum, [, w, at]) => sum + w * interpolate(f, [SETTINGS + 20, at], [0.35, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), 0);
}
function answered(f: number) {
  return QUESTIONS.filter((_, i) => i < KNOWN || f >= QUESTION(i)).length;
}

/** The phone's Settings: the graph's completeness, its questions and what is missing */
function SettingsScreen({ f }: { f: number }) {
  const shown = ramp(f, SETTINGS, 14);
  const u = answered(f) / QUESTIONS.length;
  const t = territory(f);
  const score = (u + t) / 2;
  const full = score >= 0.999;
  const R = 62;
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 18px 0', background: C.screen, opacity: shown }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 4 }}>Settings</div>
      <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 12 }}>BOOKSHELF-API · KNOWLEDGE GRAPH</div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <svg width={150} height={150} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} stroke={C.card} strokeWidth={16} fill="none" />
          <circle cx={75} cy={75} r={R} stroke={full ? C.ok : C.accent} strokeWidth={16} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - score} transform="rotate(-90 75 75)" />
          <text x={75} y={84} textAnchor="middle" fontFamily={F.head} fontWeight={700} fontSize={34} fill={C.ink}>
            {Math.round(score * 100)}%
          </text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Questions', `${answered(f)}/8`, u],
            ['Repository', `${Math.round(t * 100)}%`, t],
          ].map(([name, value, share]) => (
            <div key={name as string}>
              <div style={{ display: 'flex', fontFamily: F.body, fontSize: 13.5, color: C.ink, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, flex: 1 }}>{name}</span>
                <span style={{ color: C.muted }}>{value}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: C.card }}>
                <div style={{ height: 8, borderRadius: 4, width: `${(share as number) * 100}%`, background: full ? C.ok : C.accent }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '8px 16px' }}>
        {QUESTIONS.map((q, i) => {
          const ok = i < KNOWN || f >= QUESTION(i);
          const tick = i < KNOWN ? 1 : pop(f, QUESTION(i), true);
          return (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < QUESTIONS.length - 1 ? `1px solid ${C.card}` : 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: ok ? C.ok : 'transparent', border: `2px solid ${ok ? C.ok : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${ok ? tick : 1})` }}>
                {ok ? <Glyph path="M5 12l5 5L20 7" size={14} color="#fff" stroke /> : null}
              </div>
              <span style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: ok ? C.ink : C.muted }}>{q}</span>
              {ok ? null : <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.no }}>missing</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The repository's areas, each filling as the graph accounts for its parts */
function Territory({ f }: { f: number }) {
  const shown = pop(f, SETTINGS + 6);
  if (f < SETTINGS) return null;
  let y = 0;
  const H = 520;
  return (
    <div style={{ position: 'absolute', left: RIGHT - 200, top: 250, width: 400, opacity: shown, transform: `translateX(${60 * (1 - shown)}px)` }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, color: C.ink, marginBottom: 14 }}>Repository, by area</div>
      {AREAS.map(([name, w, at]) => {
        const h = H * w;
        const top = y;
        y += h + 8;
        const fill = interpolate(f, [SETTINGS + 20, at], [0.35, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const done = fill >= 1;
        return (
          <div key={name} style={{ position: 'absolute', top: top + 50, left: 0, width: 400, height: h, borderRadius: 14, background: C.card, overflow: 'hidden', border: `2px solid ${done ? C.ok : C.line}` }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: done ? C.washOk : C.accent + '33' }} />
            <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.mono, fontSize: 20, color: C.ink }}>
              {name}
              {done ? <Glyph path="M5 12l5 5L20 7" size={22} color={C.ok} stroke /> : null}
            </div>
            <div style={{ position: 'absolute', right: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: F.mono, fontSize: 18, color: C.muted }}>{Math.round(fill * 100)}%</div>
          </div>
        );
      })}
    </div>
  );
}

export function Measure() {
  const f = useCurrentFrame();
  const enter = pop(f, 0);
  const card = pop(f, CARD, true);
  const settings = f >= SETTINGS;
  const from = { x: RIGHT - (SCREEN0.x + SLOT.x + SLOT.w / 2), y: 720 - (SCREEN0.y + SLOT.y + SLOT.h / 2) };
  const fly = ramp(f, CARD - 18, 22, Easing.inOut(Easing.cubic));
  return (
    <AbsoluteFill>
      <Backdrop />
      <Pipeline f={f} />
      <Territory f={f} />
      <Phone
        tab={settings ? null : 'feed'}
        screen={settings ? <SettingsScreen f={f} /> : null}
        style={{ left: PHONE_AT.x - PHONE.w / 2, top: PHONE_AT.y - PHONE.h / 2, opacity: enter, transform: `translateY(${40 * (1 - enter)}px) perspective(2000px) rotateY(${settings ? 8 : -8}deg)` }}
      >
        {settings ? null : (
          <>
            <Counters unverified={21 + (f >= CARD ? 1 : 0)} verified={40} />
            <Behind depth={2} />
            <Behind depth={1} />
            <FeedCard e={WAITING} style={{ opacity: 1 - ramp(f, CARD - 4, 6) }} />
            {f >= CARD - 18 ? (
              <FeedCard
                e={SUMMARY}
                style={{
                  transform: `translate(${from.x * (1 - fly)}px, ${from.y * (1 - fly)}px) scale(${mix(fly, 0.25, 1) * mix(card, 1.04, 1)})`,
                  opacity: Math.min(1, fly * 3),
                  boxShadow: f >= CARD ? `0 0 ${40 * (1 - ramp(f, CARD, 30))}px ${C.warn}` : undefined,
                }}
              />
            ) : null}
          </>
        )}
      </Phone>
      <Headline frame={f} from={2} to={SETTINGS - 4} tag="Summarization" color={C.warn} text="Every run, summarized." sub="What changed arrives as cards you can read." />
      <Headline frame={f} from={SETTINGS} to={MEASURE_FRAMES} tag="Graph build" color={C.ok} text="Completeness, measured." sub="Never guessed: the build runs until nothing is missing." />
    </AbsoluteFill>
  );
}
