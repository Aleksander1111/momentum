// Scene 5, after the deck's "Automations" and "Triggers": a day of the schedule plays out. Each run that fires lands
// on the phone's timeline and fills the feed; at its limit the scheduled loops pause, events still start runs, and an
// approval lets the loops go on.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Glyph, PHONE, Phone } from '../kit/app.tsx';
import { Backdrop, Headline } from '../kit/stage.tsx';
import { C, DOMAINS, F, PARTS } from '../kit/theme.ts';
import { mix, pop, ramp } from '../kit/motion.ts';

export const SCHEDULE_FRAMES = 420;

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

/** An approved card with nothing implementing it, while the loops wait */
const EVENT_AT = 12.3;

const LANES: { auto: Auto; name: string; hours: number[] }[] = [
  { auto: 'exploration', name: 'Exploration', hours: Array.from({ length: 12 }, (_, i) => i * 2) },
  { auto: 'preparation', name: 'Preparation', hours: Array.from({ length: 12 }, (_, i) => i * 2 + 0.5) },
  { auto: 'validation', name: 'Validation', hours: [2] },
  { auto: 'consistency', name: 'Consistency check', hours: [3] },
  { auto: 'retention', name: 'Retention', hours: [4] },
  { auto: 'optimization', name: 'Optimization', hours: [5] },
  { auto: 'implementation', name: 'Implementation', hours: [EVENT_AT] },
];

// The day: from 00:00 to 24:00 between these frames
const DAY = { from: 16, to: 356 };
const hourAt = (f: number) => interpolate(f, [DAY.from, DAY.to], [0, 24], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const frameAt = (h: number) => DAY.from + ((DAY.to - DAY.from) * h) / 24;

// The feed: 13 cards at dawn, a card per exploration or preparation run, paused at 20, three approvals at 16:00
const LIMIT = 20;
const PAUSE_AT = 9.6;
const APPROVE_AT = 16.2;
const paused = (h: number) => h >= PAUSE_AT && h < APPROVE_AT;
const fires = (auto: Auto, h: number) => !paused(h) || auto === 'implementation';

const PANEL = { x: 790, y: 230, w: 640, laneH: 58, label: 220 };
const PHONE_AT = { x: 1640, y: 540, scale: 0.86 };

type Fired = { auto: Auto | 'implementation'; name: string; hour: number; event?: boolean };
const FIRED: Fired[] = [
  ...LANES.flatMap((l) => l.hours.filter((h) => fires(l.auto, h)).map((hour) => ({ auto: l.auto, name: l.name, hour, event: l.auto === 'implementation' }))),
].sort((a, b) => a.hour - b.hour);

function feedSize(h: number): number {
  const made = FIRED.filter((r) => r.hour <= h && (r.auto === 'exploration' || r.auto === 'preparation')).length;
  return Math.min(LIMIT, 13 + made) - (h >= APPROVE_AT ? 3 : 0);
}

const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

function SchedulePanel({ f }: { f: number }) {
  const h = hourAt(f);
  const shown = pop(f, 0);
  const hold = paused(h) ? 1 : 0;
  const x = (hr: number) => PANEL.label + ((PANEL.w - PANEL.label - 24) * hr) / 24;
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        background: C.surface,
        borderRadius: 24,
        border: `1px solid ${C.line}`,
        boxShadow: '0 30px 60px rgba(30,41,59,.14)',
        padding: '24px 0 20px',
        opacity: shown,
        transform: `perspective(2000px) rotateY(10deg) translateY(${30 * (1 - shown)}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', padding: '0 24px 14px' }}>
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, color: C.ink }}>Schedule</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: F.mono, fontSize: 30, fontWeight: 700, color: C.ink }}>{clock(h)}</span>
      </div>
      <div style={{ position: 'relative', height: LANES.length * PANEL.laneH + 14 }}>
        {[0, 6, 12, 18, 24].map((hr) => (
          <div key={hr} style={{ position: 'absolute', left: x(hr), top: 0, bottom: 0, borderLeft: `1px dashed ${C.line}` }}>
            <span style={{ position: 'absolute', top: -2, left: 4, fontFamily: F.body, fontSize: 13, color: C.muted }}>{String(hr).padStart(2, '0')}</span>
          </div>
        ))}
        {LANES.map((l, i) => {
          const y = 18 + i * PANEL.laneH;
          return (
            <div key={l.auto}>
              <div style={{ position: 'absolute', left: 24, top: y, height: 40, display: 'flex', alignItems: 'center', gap: 10, opacity: l.auto === 'implementation' ? 1 : 1 - 0.55 * hold }}>
                <Glyph path={GLYPH[l.auto]} size={24} color={l.auto === 'implementation' ? C.warn : C.ok} stroke />
                <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 18, color: C.ink, whiteSpace: 'nowrap' }}>{l.name}</span>
              </div>
              {l.hours.map((hr) => {
                const live = fires(l.auto, hr);
                const hit = h >= hr ? ramp(f, frameAt(hr), 10) : 0;
                const ring = h >= hr && live ? ramp(f, frameAt(hr), 14) : 0;
                return (
                  <div key={hr} style={{ position: 'absolute', left: x(hr) - 9, top: y + 11, width: 18, height: 18 }}>
                    {ring > 0 && ring < 1 ? <div style={{ position: 'absolute', inset: -10, borderRadius: 20, border: `3px solid ${C.ok}`, opacity: 1 - ring, transform: `scale(${0.5 + ring})` }} /> : null}
                    {l.auto === 'implementation' ? (
                      <div style={{ position: 'absolute', left: -9, top: -9, width: 36, height: 36, borderRadius: 18, background: hit > 0 ? C.warn : C.washWarn, border: `2px solid ${C.warn}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, transform: `scale(${1 + 0.3 * Math.sin(Math.PI * hit)})` }}>
                        <Glyph path={PARTS.bolt} size={20} color={hit > 0 ? '#fff' : C.warn} stroke />
                      </div>
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: 9, background: live ? (hit > 0 ? C.ok : C.washOk) : C.line, border: `2px solid ${live ? C.ok : C.muted}` }} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* The hour now */}
        <div style={{ position: 'absolute', left: x(h), top: 0, bottom: 0, width: 3, background: C.accent, borderRadius: 2, boxShadow: `0 0 12px ${C.accent}` }} />
        {hold ? (
          <div
            style={{
              position: 'absolute',
              left: x(PAUSE_AT) - 4,
              right: 24,
              top: 8,
              bottom: PANEL.laneH + 4,
              borderRadius: 12,
              background: 'rgba(247,245,240,.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: ramp(f, frameAt(PAUSE_AT), 8),
            }}
          >
            <Glyph path={PARTS.pause} size={34} color={C.no} stroke />
            <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 22, color: C.no }}>Scheduled loops paused</span>
          </div>
        ) : null}
      </div>
      <Meter f={f} />
    </div>
  );
}

/** How full the feed is */
function Meter({ f }: { f: number }) {
  const h = hourAt(f);
  const n = feedSize(h);
  const full = n >= LIMIT;
  const color = full ? C.no : C.accent;
  return (
    <div style={{ margin: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 18, color: C.ink, whiteSpace: 'nowrap' }}>Feed</span>
      <div style={{ flex: 1, height: 14, borderRadius: 7, background: C.card, overflow: 'hidden' }}>
        <div style={{ width: `${(n / LIMIT) * 100}%`, height: 14, borderRadius: 7, background: color }} />
      </div>
      <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 20, color, width: 70, textAlign: 'right' }}>
        {n}/{LIMIT}
      </span>
    </div>
  );
}

/** The phone's timeline: every run as it starts, newest on top */
function TimelineScreen({ f }: { f: number }) {
  const h = hourAt(f);
  const all: (Fired | { auto: 'approve'; name: string; hour: number })[] = [...FIRED, { auto: 'approve', name: 'You approved 3 cards', hour: APPROVE_AT }];
  const rows = all.filter((r) => r.hour <= h).sort((a, b) => b.hour - a.hour);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0' }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 12 }}>Timeline</div>
      {rows.slice(0, 9).map((r, i) => {
        const age = f - frameAt(r.hour);
        const t = ramp(age, 0, 10, Easing.out(Easing.cubic));
        const you = r.auto === 'approve';
        const event = 'event' in r && r.event;
        const tone = you ? C.no : event ? C.warn : C.ok;
        return (
          <div
            key={`${r.name}${r.hour}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              padding: '10px 12px',
              marginBottom: 8,
              opacity: i === 0 ? t : 1,
              transform: i === 0 ? `translateY(${-20 * (1 - t)}px) scale(${mix(t, 0.94, 1)})` : undefined,
              boxShadow: i === 0 && age < 24 ? `0 0 ${20 * (1 - age / 24)}px ${tone}88` : undefined,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 18, background: tone + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Glyph path={you ? 'M5 12l5 5L20 7' : GLYPH[r.auto as Auto]} size={20} color={tone} stroke />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: C.ink }}>{r.name}</div>
              <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted }}>{you ? 'feed has room again' : event ? 'event · an approved card' : 'schedule · bookshelf-api'}</div>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 12.5, color: C.muted }}>{clock(r.hour)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Schedule() {
  const f = useCurrentFrame();
  const enter = pop(f, 4);
  return (
    <AbsoluteFill>
      <Backdrop />
      <SchedulePanel f={f} />
      <Phone
        tab="timeline"
        screen={<TimelineScreen f={f} />}
        style={{
          left: PHONE_AT.x - PHONE.w / 2,
          top: PHONE_AT.y - PHONE.h / 2,
          opacity: enter,
          transform: `perspective(2000px) rotateY(-12deg) scale(${PHONE_AT.scale * mix(enter, 0.92, 1)})`,
        }}
      />
      <Headline frame={f} from={2} to={frameAt(PAUSE_AT) - 6} tag="Automations" color={C.ok} text="Twelve automations, on their own." sub="On a schedule, on an event, or when you ask." />
      <Headline frame={f} from={frameAt(PAUSE_AT) - 2} to={SCHEDULE_FRAMES} tag="Triggers" color={C.no} text="Paced by your attention." sub="Loops wait while your feed is full." />
    </AbsoluteFill>
  );
}
