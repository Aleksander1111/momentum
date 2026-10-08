// Scene 7, after the deck's "Summarization" and "Graph completeness". The camera dives into the phone, into a run's
// diff scrolling past full screen; the run stops, the lines fold up into one card and the camera pulls back out to
// find it in the feed. Then the repository rises beside the phone as a city of its areas, each block standing up as
// the graph accounts for it, while the phone's Settings measure the graph to 100%.
import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, type Entity } from '../kit/app.tsx';
import { Backdrop, CornerHeadline } from '../kit/stage.tsx';
import { C, F, PARTS } from '../kit/theme.ts';
import { dwelt, mix, pop, ramp, useSceneFrame } from '../kit/motion.ts';
import { type Cue, Voice, voiceDwells } from '../kit/voice.tsx';

export const MEASURE_FRAMES = 472;

// Beats
const DIVE = { from: 14, to: 54 };
const STOP = 124;
const FOLD = { from: 136, to: 160 };
const OUT = { from: 156, to: 196 };
const CITY = 236;
const QUESTION = (i: number) => CITY + 40 + i * 20;

const SUMMARY: Entity = {
  project: { name: 'bookshelf', color: '#1D6FD6' },
  type: 'Product/Feature',
  title: 'Search by author or title',
  desc: 'Readers can now find a book by author or title.',
  bullets: ['Planned, done and checked', '9 new checks, all passing'],
  state: 'unverified',
};

/** A run's diff: three files, mostly added lines */
const DIFF: { file?: string; mark?: '+' | '-'; text: string }[] = (() => {
  const files: [string, string[]][] = [
    ['src/routes/books.js', ['export async function books(req, res) {', '  const url = new URL(req.url, BASE);', '  const q = url.searchParams.get("q");', '  if (q) return send(res, 200, find(q));', '  if (req.method === "GET") return list(res);', '  if (req.method === "POST") return add(req, res);', '  return send(res, 405);', '}']],
    ['src/store.js', ['search(q) {', '  const needle = q.trim().toLowerCase();', '  return this.all().filter((b) =>', '    has(b.title, needle) ||', '    has(b.author, needle));', '}']],
    ['test/books.test.js', ['test("finds a book by author", async () => {', '  const res = await get("/books?q=le guin");', '  assert.equal(res.status, 200);', '  assert.equal(res.body[0].year, 1974);', '});', 'test("finds a book by title", async () => {', '  const res = await get("/books?q=dune");', '  assert.equal(res.body.length, 1);', '});', 'test("an empty query lists all", async () => {', '  assert.equal((await get("/books?q=")).body.length, 12);', '});']],
  ];
  return files.flatMap(([file, lines]) => [{ file, text: file }, ...lines.map((text, i) => ({ mark: (i === 4 && file === 'src/routes/books.js' ? '-' : '+') as '+' | '-', text }))]);
})();

/** The phone's screen during the run: the diff, scrolling as it is written, then folding into one card */
function DiffScreen({ f }: { f: number }) {
  const fold = ramp(f, FOLD.from, FOLD.to - FOLD.from, Easing.inOut(Easing.cubic));
  const stopped = f >= STOP;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.surface, padding: '60px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 8px', fontFamily: F.body, fontWeight: 700, fontSize: 13, color: C.ink, borderBottom: `1px solid ${C.line}` }}>
        <Glyph path={PARTS.terminal} size={16} color={C.ok} stroke />
        Work in progress · bookshelf
        <span style={{ flex: 1 }} />
        <span style={{ color: stopped ? C.ok : C.stateUpdating }}>{stopped ? 'done' : 'working'}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 90, bottom: 82, overflow: 'hidden' }}>
        <div style={{ transform: `scaleY(${1 - 0.92 * fold})`, transformOrigin: '50% 45%', opacity: 1 - ramp(f, FOLD.to - 6, 8) }}>
          {DIFF.map((l, i) => {
            const written = f >= DIVE.from + i * 2.4;
            if (l.file) {
              return (
                <div key={i} style={{ fontFamily: F.mono, fontSize: 11.5, fontWeight: 700, color: C.ink, background: C.card, padding: '5px 12px', marginTop: 6, opacity: written ? 1 : 0 }}>
                  {l.text}
                </div>
              );
            }
            return (
              <div key={i} style={{ display: 'flex', gap: 6, fontFamily: F.mono, fontSize: 11, lineHeight: '15px', color: C.ink, background: l.mark === '+' ? 'rgba(63,107,82,.16)' : 'rgba(160,64,47,.16)', padding: '0 12px', opacity: written ? 1 : 0, whiteSpace: 'pre' }}>
                <span style={{ color: l.mark === '+' ? C.ok : C.no, width: 8 }}>{l.mark}</span>
                {l.text}
              </div>
            );
          })}
        </div>
      </div>
      {stopped ? (
        <div style={{ position: 'absolute', left: '50%', top: 360, transform: `translate(-50%, -50%) scale(${pop(f, STOP, true)})`, opacity: 1 - ramp(f, FOLD.to, 8), background: C.warn, color: '#fff', borderRadius: 999, padding: '6px 14px', fontFamily: F.body, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', boxShadow: `0 0 20px ${C.warn}` }}>
          <Glyph path={PARTS.sparkles} size={14} color="#fff" stroke />
          Writing it up
        </div>
      ) : null}
    </div>
  );
}

const QUESTIONS = ['What it is', 'What it is for', 'What it does', 'How it is built', 'Where the code is', 'Where it runs', 'How it is tested', 'Rules and decisions'];
const KNOWN = 5;

// The repository's areas on the ground, each split into its parts: a part rises once the graph accounts for it
type Block = { area: string; x: number; y: number; w: number; d: number; h: number; at: number };
const BLOCKS: Block[] = [
  { area: 'src', x: 0, y: 0, w: 250, d: 250, h: 170, at: 0 },
  { area: 'src', x: 270, y: 0, w: 250, d: 250, h: 130, at: 30 },
  { area: 'src', x: 0, y: 270, w: 250, d: 250, h: 150, at: 70 },
  { area: 'src', x: 270, y: 270, w: 250, d: 250, h: 110, at: 140 },
  { area: 'test', x: 560, y: 0, w: 170, d: 250, h: 120, at: 10 },
  { area: 'test', x: 750, y: 0, w: 170, d: 250, h: 100, at: 110 },
  { area: 'test', x: 560, y: 270, w: 360, d: 250, h: 90, at: 165 },
  { area: 'docs', x: 0, y: 560, w: 340, d: 220, h: 80, at: 20 },
  { area: 'docs', x: 360, y: 560, w: 160, d: 220, h: 70, at: 95 },
  { area: 'examples', x: 560, y: 560, w: 220, d: 220, h: 60, at: 180 },
  { area: 'root', x: 800, y: 560, w: 120, d: 220, h: 50, at: 50 },
];
const GROUND = 920;
// The phone's score settles first; the blocks rise after, as its confirmation
const riseOf = (b: Block, f: number) => ramp(f, CITY + 50 + b.at * 0.5, 16, Easing.out(Easing.back(1.4)));

function territory(f: number) {
  const all = BLOCKS.reduce((s, b) => s + b.w * b.d, 0);
  return BLOCKS.reduce((s, b) => s + (riseOf(b, f) >= 0.99 ? b.w * b.d : 0.3 * b.w * b.d), 0) / all;
}
const answered = (f: number) => QUESTIONS.filter((_, i) => i < KNOWN || f >= QUESTION(i)).length;
const score = (f: number) => (answered(f) / QUESTIONS.length + territory(f)) / 2;

/** One part of the repository: a box standing on the ground, hollow until accounted for */
function Box({ b, f }: { b: Block; f: number }) {
  const rise = riseOf(b, f);
  const h = 14 + (b.h - 14) * rise;
  const done = rise >= 0.99;
  const top = done ? '#E6F0E8' : 'rgba(255,255,255,.6)';
  const side = done ? '#A9C4B0' : 'rgba(213,217,211,.5)';
  const front = done ? '#7FA68B' : 'rgba(190,196,188,.5)';
  const edge = done ? C.ok : C.muted;
  const face: CSSProperties = { position: 'absolute', border: `2px ${done ? 'solid' : 'dashed'} ${edge}`, boxSizing: 'border-box' };
  return (
    <>
      <div style={{ ...face, left: b.x, top: b.y - h, width: b.w, height: h, background: front, transformOrigin: 'bottom', transform: 'rotateX(-90deg)' }} />
      <div style={{ ...face, left: b.x - h, top: b.y, width: h, height: b.d, background: side, transformOrigin: 'right', transform: 'rotateY(90deg)' }} />
      <div style={{ ...face, left: b.x, top: b.y + b.d, width: b.w, height: h, background: front, transformOrigin: 'top', transform: 'rotateX(90deg)' }} />
      <div style={{ ...face, left: b.x + b.w, top: b.y, width: h, height: b.d, background: side, transformOrigin: 'left', transform: 'rotateY(-90deg)' }} />
      <div style={{ ...face, left: b.x, top: b.y, width: b.w, height: b.d, background: top, transform: `translateZ(${h}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {done ? <Glyph path="M5 12l5 5L20 7" size={60} color={C.ok} stroke /> : null}
      </div>
    </>
  );
}

function City({ f }: { f: number }) {
  const shown = ramp(f, CITY - 20, 30, Easing.out(Easing.cubic));
  if (shown <= 0) return null;
  const rz = interpolate(f, [CITY, MEASURE_FRAMES], [-48, -36]);
  const labels: [string, number, number][] = [
    ['Product', 260, 400],
    ['Checks', 740, 400],
    ['Docs', 260, 670],
    ['Examples', 670, 670],
  ];
  return (
    <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: '1300px 360px', opacity: shown }}>
      <div style={{ position: 'absolute', left: 1300 - GROUND / 2, top: 640 - GROUND / 2, width: GROUND, height: GROUND, transformStyle: 'preserve-3d', transform: `translateY(${80 * (1 - shown)}px) rotateX(58deg) rotateZ(${rz}deg) scale(0.8)` }}>
        <div style={{ position: 'absolute', inset: -40, borderRadius: 30, background: C.card, border: `2px solid ${C.line}`, boxShadow: '0 60px 80px rgba(30,41,59,.15)' }} />
        {BLOCKS.map((b, i) => (
          <Box key={i} b={b} f={f} />
        ))}
        {labels.map(([name, x, y]) => (
          <div key={name} style={{ position: 'absolute', left: x, top: y, transformStyle: 'preserve-3d', transform: `translateZ(190px) rotateZ(${-rz}deg) rotateX(-58deg)` }}>
            <div style={{ transform: 'translate(-50%, -50%)', fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: C.ink, background: 'rgba(255,255,255,.9)', borderRadius: 10, padding: '4px 14px', whiteSpace: 'nowrap' }}>{name}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** The phone's Settings: the graph's completeness, its questions and what is missing */
function SettingsScreen({ f }: { f: number }) {
  const shown = ramp(f, CITY - 10, 14);
  const u = answered(f) / QUESTIONS.length;
  const t = territory(f);
  const s = score(f);
  const full = s >= 0.999;
  const R = 62;
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 18px 0', background: C.screen, opacity: shown }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 4 }}>Settings</div>
      <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 12 }}>BOOKSHELF · HOW WELL IT IS UNDERSTOOD</div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <svg width={150} height={150} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} stroke={C.card} strokeWidth={16} fill="none" />
          <circle cx={75} cy={75} r={R} stroke={full ? C.ok : C.accent} strokeWidth={16} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - s} transform="rotate(-90 75 75)" />
          <text x={75} y={84} textAnchor="middle" fontFamily={F.head} fontWeight={700} fontSize={34} fill={C.ink}>
            {Math.round(s * 100)}%
          </text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(
            [
              ['Questions answered', `${answered(f)}/8`, u],
              ['Project covered', `${Math.round(t * 100)}%`, t],
            ] as const
          ).map(([name, value, share]) => (
            <div key={name}>
              <div style={{ display: 'flex', fontFamily: F.body, fontSize: 13.5, color: C.ink, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, flex: 1 }}>{name}</span>
                <span style={{ color: C.muted }}>{value}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: C.card }}>
                <div style={{ height: 8, borderRadius: 4, width: `${share * 100}%`, background: full ? C.ok : C.accent }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '8px 16px' }}>
        {QUESTIONS.map((q, i) => {
          const ok = i < KNOWN || f >= QUESTION(i);
          return (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < QUESTIONS.length - 1 ? `1px solid ${C.card}` : 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: ok ? C.ok : 'transparent', border: `2px solid ${ok ? C.ok : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${i < KNOWN || !ok ? 1 : pop(f, QUESTION(i), true)})` }}>
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

/** Giant words over the dive */
function Giant({ f, from, to, text, color, top = 420 }: { f: number; from: number; to: number; text: string; color: string; top?: number }) {
  if (f < from || f > to) return null;
  const t = ramp(f, from, 12, Easing.out(Easing.cubic)) * (1 - ramp(f, to - 10, 10));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, padding: '20px 0 34px', background: `linear-gradient(transparent, rgba(255,255,255,${0.85 * t}) 25%, rgba(255,255,255,${0.85 * t}) 75%, transparent)`, textAlign: 'center', fontFamily: F.head, fontWeight: 700, fontSize: 150, color, opacity: t, transform: `scale(${mix(t, 0.9, 1)})`, textShadow: '0 6px 40px rgba(255,255,255,.95), 0 0 80px rgba(255,255,255,.9)', letterSpacing: -2 }}>
      {text}
    </div>
  );
}

/** The narration: a line per beat */
export const MEASURE_CUES: Cue[] = [
  { at: 64, hold: 210, text: 'When work is finished, you read one card, not a pile of changes.' },
  { at: 236, hold: 460, text: 'And you see how well each project is understood.' },
];
const DWELLS = voiceDwells('Measure', MEASURE_CUES, MEASURE_FRAMES);
export const MEASURE_LENGTH = dwelt(MEASURE_FRAMES, DWELLS);

export function Measure() {
  const f = useSceneFrame(DWELLS);
  const enter = pop(f, 0);
  // The camera: into the phone's screen, then back out, then the phone steps aside for the city
  const dive = ramp(f, DIVE.from, DIVE.to - DIVE.from, Easing.inOut(Easing.cubic)) * (1 - ramp(f, OUT.from, OUT.to - OUT.from, Easing.inOut(Easing.cubic)));
  const aside = ramp(f, CITY - 20, 30, Easing.inOut(Easing.cubic));
  // Larger once aside, so its Settings read beside the city
  // Close enough to read the diff, never so close that its header or last lines leave the frame
  const scale = mix(dive, 0.66, 1.45) * mix(aside, 1, 1.22);
  const x = mix(aside, 960, 470);
  const settings = f >= CITY - 10;
  const landed = pop(f, FOLD.to - 6, true);
  return (
    <AbsoluteFill>
      <Voice scene="Measure" cues={MEASURE_CUES} dwells={DWELLS} />
      <Backdrop />
      <City f={f} />
      <Phone
        tab={settings ? null : f < OUT.from ? 'chat' : 'feed'}
        // Out of the frame at the bottom while the camera is close: gone until it pulls back
        bar={1 - Math.min(1, Math.max(0, (dive - 0.3) / 0.3))}
        screen={settings ? <SettingsScreen f={f} /> : f < FOLD.to ? <DiffScreen f={f} /> : null}
        style={{ left: x - PHONE.w / 2, top: 540 + 16 * dive - PHONE.h / 2, opacity: enter, transform: `translateY(${40 * (1 - enter)}px) perspective(2000px) rotateY(${12 * aside}deg) scale(${scale})` }}
      >
        {!settings && f >= FOLD.to ? (
          <>
            <Counters unverified={22} verified={40} />
            <Behind depth={2} />
            <Behind depth={1} />
            <FeedCard e={SUMMARY} style={{ transform: `scale(${mix(landed, 0.3, 1)})`, opacity: Math.min(1, landed * 2), boxShadow: `0 0 ${50 * (1 - ramp(f, FOLD.to, 40))}px ${C.warn}` }} />
          </>
        ) : null}
      </Phone>
      <Giant f={f} from={DIVE.to - 4} to={STOP + 4} text="A pile of changes." color={C.ok} />
      <Giant f={f} from={FOLD.from} to={OUT.to + 20} text="One card to read." color={C.warn} top={40} />
      <CornerHeadline frame={f} from={CITY + 10} to={MEASURE_FRAMES} side="right" tag="Graph build" color={C.ok} text="Completeness, measured." sub="Every area accounted for, every question answered." />
    </AbsoluteFill>
  );
}
