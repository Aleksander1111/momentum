// Scene 5, after the deck's "Automations" and "Triggers": a day on the desk, seen from above as a time-lapse. The
// phone lies on the desk while the sun's shadow sweeps round it; the automations orbit it and, each at its hour,
// drop a card on the feed's pile. At the feed's limit the orbit stops and the loops wait, though an event still
// starts its run; your approvals make room and the day goes on.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, ProjectMark, Stamp, TypePill, type Entity } from '../kit/app.tsx';
import { CornerHeadline } from '../kit/stage.tsx';
import { C, DOMAINS, F, ICONS, PARTS } from '../kit/theme.ts';
import { dwelt, mix, pop, ramp, useAmbientFrame, useSceneFrame } from '../kit/motion.ts';
import { type Cue, useDrift, Voice, voiceDwells } from '../kit/voice.tsx';

export const SCHEDULE_FRAMES = 510;

const GLYPH = {
  exploration: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  preparation: 'M10 6h10M10 12h10M10 18h10M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  validation: DOMAINS.Testing!.path,
  consistency: DOMAINS.Governance!.path,
  retention: 'M19 3l-7 7M9.5 9.5l5 5M4 21c3.5 0 6.5-2 8.5-5.5l-5-5C4 12.5 3 17 4 21z',
  optimization: PARTS.sparkles,
  implementation: DOMAINS.Code!.path,
} as const;
type Auto = keyof typeof GLYPH;

/** An approved card with nothing implementing it: an event, while the loops wait */
const EVENT_AT = 12.3;
const SATELLITES: { auto: Auto; name: string; hours: number[]; event?: boolean }[] = [
  { auto: 'exploration', name: 'Ideas', hours: Array.from({ length: 12 }, (_, i) => i * 2) },
  { auto: 'preparation', name: 'Plans', hours: Array.from({ length: 12 }, (_, i) => i * 2 + 0.5) },
  { auto: 'validation', name: 'Checks', hours: [2] },
  { auto: 'consistency', name: 'Consistency', hours: [3] },
  { auto: 'retention', name: 'Tidy-up', hours: [4] },
  { auto: 'optimization', name: 'Learning', hours: [5] },
  { auto: 'implementation', name: 'Work', hours: [EVENT_AT], event: true },
];

// The day: 00:00 to 24:00 between these frames
const DAY = { from: 20, to: 452 };
const hourAt = (f: number) => interpolate(f, [DAY.from, DAY.to], [0, 24], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const frameAt = (h: number) => DAY.from + ((DAY.to - DAY.from) * h) / 24;

// The feed: 30 cards at midnight, one per exploration or preparation run, waiting at its default size of 40
const LIMIT = 40;
const START = 30;
// Late enough that the wait is long enough to be told
const APPROVE_AT = 19.4;
/** How many cards you approve at once, making room for the rest of the day */
const APPROVED = 10;
const SWEEP = (k: number) => frameAt(APPROVE_AT) - 56 + k * 5;
const RUNS = SATELLITES.flatMap((s, i) => s.hours.map((hour) => ({ ...s, i, hour }))).sort((a, b) => a.hour - b.hour);
/** Every run of the day in order, and whether it could start: scheduled ones wait while the feed is full */
const FIRED = (() => {
  let size = START;
  let approved = false;
  return RUNS.map((r) => {
    if (!approved && r.hour >= APPROVE_AT) {
      size -= APPROVED;
      approved = true;
    }
    const waits = !r.event && size >= LIMIT;
    const card = !waits && (r.auto === 'exploration' || r.auto === 'preparation');
    if (card) size += 1;
    return { ...r, waits, card };
  });
})();
const PAUSE_AT = FIRED.find((r) => r.waits)!.hour;
const paused = (h: number) => h >= PAUSE_AT && h < APPROVE_AT;
function feedSize(h: number) {
  const made = FIRED.filter((r) => r.hour <= h && r.card).length;
  return START + made - (h >= APPROVE_AT ? APPROVED : 0);
}

const TITLES = ['Plan: search by author', 'Idea: reading lists', 'Task: book covers', 'Plan: gift cards', 'Problem: duplicate books', 'Idea: reviews', 'Task: export to Excel', 'Plan: author pages', 'Task: sort by year', 'Idea: recommendations', 'Plan: newsletter', 'Task: new home page'];
const cardOf = (n: number): Entity => ({
  project: { name: 'bookshelf', color: '#1D6FD6' },
  type: n % 2 ? 'Product/Task' : 'Harness/Plan',
  title: TITLES[n % TITLES.length]!,
  desc: 'Prepared while you were away, waiting for your swipe.',
  bullets: [],
  state: 'unverified',
});

// The desk: a plane seen from above at an angle, the phone at its centre
const DESK = 2000;
const TILT = 38;
const ORBIT = 600;
const PILE = { x: DESK / 2 + 430, y: DESK / 2 + 40 };
const SHEET = 2.4;

const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

/** Something standing up from the desk, facing the camera however the desk turns */
function Upright({ x, y, rz, lift = 0, children }: { x: number; y: number; rz: number; lift?: number; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transformStyle: 'preserve-3d', transform: `translateZ(${lift}px) rotateZ(${-rz}deg) rotateX(${-TILT}deg)` }}>
      <div style={{ position: 'absolute', left: 0, bottom: 0, transform: 'translateX(-50%)' }}>{children}</div>
    </div>
  );
}

function Satellite({ f, i, angle, rz, still }: { f: number; i: number; angle: number; rz: number; still: number }) {
  const s = SATELLITES[i]!;
  const h = hourAt(f);
  // A pulse each time it fires; a greyed disc while its loop waits
  const last = FIRED.filter((r) => r.i === i && !r.waits && r.hour <= h).at(-1);
  const pulse = last ? 1 - ramp(f, frameAt(last.hour), 14) : 0;
  const waiting = s.event ? 0 : still;
  const color = s.event ? C.warn : C.ok;
  const badge: CSSProperties = { position: 'absolute', right: -10, top: -10, width: 38, height: 38, borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' };
  return (
    <Upright x={DESK / 2 + ORBIT * Math.cos(angle)} y={DESK / 2 + ORBIT * Math.sin(angle)} rz={rz}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: pop(f, 4 + i * 3), filter: `grayscale(${waiting})`, transform: `scale(${1 + 0.35 * pulse})` }}>
        <div style={{ position: 'relative', width: 92, height: 92, borderRadius: 46, background: pulse > 0.05 ? color : C.surface, border: `5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 16px 30px rgba(30,41,59,.25), 0 0 ${50 * pulse}px ${color}` }}>
          <Glyph path={GLYPH[s.auto]} size={46} color={pulse > 0.05 ? '#fff' : color} stroke />
          {s.event ? (
            <div style={{ ...badge, background: C.no }}>
              <Glyph path={PARTS.bolt} size={20} color="#fff" stroke />
            </div>
          ) : (
            <div style={{ ...badge, background: waiting > 0.5 ? C.no : C.warn }}>
              {waiting > 0.5 ? <Glyph path={PARTS.pause} size={20} color="#fff" stroke /> : <Glyph path={ICONS.clock} size={22} color="#fff" />}
            </div>
          )}
        </div>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 26, color: C.ink, background: 'rgba(255,255,255,.88)', borderRadius: 999, padding: '2px 14px', whiteSpace: 'nowrap' }}>{s.name}</div>
      </div>
    </Upright>
  );
}

/** Cards flying in an arc from a satellite onto the pile */
function Drops({ f, angleOf }: { f: number; angleOf: (i: number) => number }) {
  return (
    <>
      {FIRED.filter((r) => r.card).map((r) => {
        const t = ramp(f, frameAt(r.hour), 16, Easing.inOut(Easing.cubic));
        if (t <= 0 || t >= 1) return null;
        const a = angleOf(r.i);
        const x = mix(t, DESK / 2 + ORBIT * Math.cos(a), PILE.x);
        const y = mix(t, DESK / 2 + ORBIT * Math.sin(a), PILE.y);
        return (
          <div
            key={`${r.auto}${r.hour}`}
            style={{ position: 'absolute', left: x - 90, top: y - 120, width: 180, height: 240, borderRadius: 14, background: C.surface, border: `3px solid ${C.ok}`, transform: `translateZ(${120 + 300 * Math.sin(Math.PI * t)}px) rotateZ(${40 * (1 - t)}deg)`, boxShadow: '0 20px 30px rgba(30,41,59,.2)' }}
          />
        );
      })}
    </>
  );
}

/** The feed's cards as a pile on the desk, a sheet per card, swept off as you approve them */
/** A card on the pile as it lies face up: what it is and what it is about */
function Face({ e }: { e: Entity }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TypePill type={e.type} size={11} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.body, fontWeight: 700, fontSize: 13, color: C.muted }}>
        <ProjectMark project={e.project} size={16} />
        {e.project.name}
      </div>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 17, lineHeight: 1.15, color: C.ink, overflowWrap: 'anywhere' }}>{e.title}</div>
      {[0.9, 0.75, 0.82].map((w, i) => (
        <div key={i} style={{ height: 7, width: `${w * 100}%`, borderRadius: 4, background: C.line }} />
      ))}
    </div>
  );
}

function Pile({ f, rz }: { f: number; rz: number }) {
  const h = hourAt(f);
  const n = feedSize(h);
  const full = n >= LIMIT;
  const sweep = Array.from({ length: APPROVED }, (_, k) => ramp(f, SWEEP(k), 12, Easing.in(Easing.cubic)));
  const sweeping = f >= SWEEP(0) && f < frameAt(APPROVE_AT);
  const sheets = sweeping ? LIMIT - APPROVED : n;
  const sheet = (k: number): CSSProperties => ({ position: 'absolute', left: PILE.x - 90, top: PILE.y - 120, width: 180, height: 240, borderRadius: 14, border: `1px solid ${C.line}` });
  return (
    <>
      {Array.from({ length: sheets }, (_, k) => (
        <div key={k} style={{ ...sheet(k), background: k === sheets - 1 || k % 2 ? C.surface : C.behind1, transform: `translateZ(${k * SHEET}px) rotateZ(${((k * 37) % 9) - 4}deg)`, boxShadow: k === 0 ? '0 30px 40px rgba(30,41,59,.25)' : undefined }}>
          {k === sheets - 1 ? <Face e={cardOf(k)} /> : null}
        </div>
      ))}
      {sweeping
        ? sweep.map((t, k) => (
            <div key={`a${k}`} style={{ ...sheet(k), background: C.surface, border: `2px solid ${C.ok}`, transform: `translateZ(${(LIMIT - 1 - k) * SHEET + 200 * t}px) translateX(${700 * t}px) rotateZ(${30 * t}deg)`, opacity: 1 - t }}>
              <Face e={cardOf(LIMIT - 1 - k)} />
              <Stamp kind="ok" label="APPROVE" style={{ left: 14, top: 150 }} />
            </div>
          ))
        : null}
    </>
  );
}

/** The narration: a line per beat */
export const SCHEDULE_CUES: Cue[] = [
  { at: 8, hold: frameAt(PAUSE_AT) - 10, text: 'Day and night, your projects keep moving.' },
  { at: frameAt(PAUSE_AT) + 2, hold: SWEEP(0) - 6, text: 'When your feed is full, everything waits for you.' },
  { at: SWEEP(0), hold: SCHEDULE_FRAMES - 30, text: 'Never more work than you can review.' },
];
const DWELLS = voiceDwells('Schedule', SCHEDULE_CUES, SCHEDULE_FRAMES);
export const SCHEDULE_LENGTH = dwelt(SCHEDULE_FRAMES, DWELLS);

export function Schedule() {
  const f = useSceneFrame(DWELLS);
  const real = useAmbientFrame();
  const h = hourAt(f);
  // The orbit turns with the day, and stands still while the loops wait
  const still = paused(h) ? ramp(f, frameAt(PAUSE_AT), 10) * (1 - ramp(f, frameAt(APPROVE_AT), 10)) : 0;
  const moving = Math.min(f, frameAt(PAUSE_AT)) + Math.max(0, f - frameAt(APPROVE_AT));
  const turned = moving * 0.006;
  const angleOf = (i: number) => (i / SATELLITES.length) * Math.PI * 2 + turned;
  const rz = mix(useDrift(0, DWELLS, SCHEDULE_LENGTH), -18, 12);
  // The sun's shadow: from the west at dawn, round to the east at dusk; a little dimmer at night
  const sun = ((h - 6) / 12) * Math.PI;
  const shadow = { x: -Math.cos(sun) * 60, y: 40 + 30 * Math.sin(sun) };
  const night = Math.max(0, Math.cos((h / 24) * Math.PI * 2)) ** 2;
  const n = feedSize(h);
  const made = FIRED.filter((r) => r.card && r.hour <= h).length;
  const swipes = Array.from({ length: APPROVED }, (_, k) => ramp(f, SWEEP(k), 12, Easing.in(Easing.cubic)));
  const swiping = swipes.findIndex((t) => t > 0 && t < 1);
  const enter = pop(f, 0);

  return (
    <AbsoluteFill style={{ background: '#E6DFD2', overflow: 'hidden' }}>
      <Voice scene="Schedule" cues={SCHEDULE_CUES} dwells={DWELLS} />
      <AbsoluteFill style={{ perspective: 2000, perspectiveOrigin: '1010px 340px' }}>
        <div
          style={{
            position: 'absolute',
            left: 1010 - DESK / 2,
            top: 560 - DESK / 2,
            width: DESK,
            height: DESK,
            transformStyle: 'preserve-3d',
            transform: `translateY(${80 * (1 - enter)}px) rotateX(${TILT}deg) rotateZ(${rz}deg) scale(${mix(enter, 0.86, 0.78)})`,
          }}
        >
          {/* The desk: wood grain under the day's light */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 40, background: 'repeating-linear-gradient(92deg, #EFE8DC 0px, #EAE2D4 22px, #F1EBE0 41px, #E8DFD0 63px)', boxShadow: 'inset 0 0 200px rgba(120,90,50,.18)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 40, background: `radial-gradient(circle at ${50 + 40 * Math.cos(sun)}% ${30 + 10 * Math.sin(sun)}%, rgba(255,240,210,.55), transparent 60%)` }} />
          <div style={{ position: 'absolute', left: DESK / 2 - ORBIT, top: DESK / 2 - ORBIT, width: ORBIT * 2, height: ORBIT * 2, borderRadius: ORBIT, border: `4px dashed ${still > 0.5 ? C.no : C.accent}66`, transform: `rotateZ(${turned * 57}deg)` }} />
          {/* The phone, its shadow, and a red ring while the feed is full */}
          <div style={{ position: 'absolute', left: DESK / 2 - PHONE.w / 2 + shadow.x, top: DESK / 2 - PHONE.h / 2 + shadow.y, width: PHONE.w, height: PHONE.h, borderRadius: 58, background: 'rgba(60,45,25,.28)', filter: 'blur(26px)' }} />
          <div style={{ position: 'absolute', left: DESK / 2 - PHONE.w / 2 - 30, top: DESK / 2 - PHONE.h / 2 - 30, width: PHONE.w + 60, height: PHONE.h + 60, borderRadius: 80, border: `6px solid ${C.no}`, opacity: still * (0.5 + 0.5 * Math.sin(real / 4)), transform: 'translateZ(2px)' }} />
          <Phone style={{ left: DESK / 2 - PHONE.w / 2, top: DESK / 2 - PHONE.h / 2, transform: 'translateZ(6px)', boxShadow: 'none' }}>
            <Counters unverified={n} verified={51 + (h >= APPROVE_AT ? APPROVED : 0)} />
            <Behind depth={2} />
            <Behind depth={1} />
            <FeedCard e={cardOf(Math.max(0, made - 1) + (swiping >= 0 ? swiping : 0))} style={{ transform: swiping >= 0 ? `translateX(${swipes[swiping]! * 420}px) rotate(${swipes[swiping]! * 10}deg)` : undefined }}>
              {swiping >= 0 ? <Stamp kind="ok" label="APPROVE" style={{ left: 22, top: 200, opacity: Math.min(1, swipes[swiping]! * 4) }} /> : null}
            </FeedCard>
          </Phone>
          <Pile f={f} rz={rz} />
          <Drops f={f} angleOf={angleOf} />
          {SATELLITES.map((_, i) => (
            <Satellite key={i} f={f} i={i} angle={angleOf(i)} rz={rz} still={still} />
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'rgb(40,52,90)', opacity: 0.16 * night, pointerEvents: 'none' }} />
      <Clock h={h} still={still} />
      <FeedGauge n={n} />
      <CornerHeadline frame={f} from={4} to={frameAt(PAUSE_AT) - 4} tag="Automations" color={C.ok} text="Your projects keep moving." sub="Ideas, plans, checks: each on its schedule." />
      <CornerHeadline frame={f} from={frameAt(PAUSE_AT)} to={frameAt(APPROVE_AT) + 4} tag="Triggers" color={C.no} text="Your feed is full. The loops wait." sub="Only urgent work still starts." />
      <CornerHeadline frame={f} from={frameAt(APPROVE_AT) + 8} to={SCHEDULE_FRAMES} tag="Paced by you" color={C.ok} text="Make room, and they go on." sub="Never more work than you can review." />
    </AbsoluteFill>
  );
}

function Clock({ h, still }: { h: number; still: number }) {
  const day = h >= 6 && h < 20;
  return (
    <div style={{ position: 'absolute', right: 90, top: 70, display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(255,255,255,.92)', borderRadius: 24, padding: '16px 28px', boxShadow: '0 16px 40px rgba(30,41,59,.15)' }}>
      <Glyph
        path={day ? 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' : 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'}
        size={44}
        color={day ? C.stateUnverified : C.accent}
        stroke
      />
      <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 64, color: C.ink, letterSpacing: 2 }}>{clock(h)}</span>
      {still > 0.5 ? <Glyph path={PARTS.pause} size={40} color={C.no} stroke /> : null}
    </div>
  );
}

/** How full the feed is, beside the clock where nothing on the desk passes over it */
function FeedGauge({ n }: { n: number }) {
  const full = n >= LIMIT;
  return (
    <div style={{ position: 'absolute', right: 90, top: 186, display: 'flex', alignItems: 'center', gap: 14, background: full ? C.no : 'rgba(255,255,255,.92)', color: full ? '#fff' : C.ink, borderRadius: 999, padding: '12px 26px', boxShadow: '0 16px 40px rgba(30,41,59,.15)', fontFamily: F.mono, fontWeight: 700, fontSize: 40, whiteSpace: 'nowrap' }}>
      <Glyph path={ICONS.feed} size={36} color={full ? '#fff' : C.accent} />
      {n} / {LIMIT}
      <span style={{ fontFamily: F.body, fontSize: 26, fontWeight: 400 }}>{full ? 'feed full' : 'in your feed'}</span>
    </div>
  );
}
