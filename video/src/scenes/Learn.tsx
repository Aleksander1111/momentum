// Scene 6, after the deck's "Automation management": a triptych. Three phones, three chats in three projects, and the
// same request lights up in each; the three sentences lift out of the screens and merge into one pattern. The change
// it proposes lands in the feed of the phone in the middle and ripples out to every project at once, each turning
// over to show its updated definition, while it waits for your swipe.
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Behind, Bubble, Counters, FeedCard, Glyph, PHONE, Phone, ProjectMark, SLOT, Stamp, TypePill, type Entity, type Project } from '../kit/app.tsx';
import { Backdrop, BottomHeadline, Finger } from '../kit/stage.tsx';
import { C, F, PARTS } from '../kit/theme.ts';
import { dwell, dwelt, mix, pop, ramp } from '../kit/motion.ts';
import { type Cue, Voice, voiceDwells } from '../kit/voice.tsx';

export const LEARN_FRAMES = 450;

const P: Record<string, Project> = {
  todo: { name: 'to-do app', color: '#C2410C' },
  notes: { name: 'notes', color: '#0F766E' },
  books: { name: 'bookshelf', color: '#1D6FD6' },
  handbook: { name: 'handbook', color: '#7C3AED' },
};

const CHATS: { project: Project; title: string; before: string; said: string; after: string }[] = [
  { project: P.todo!, title: 'Due dates', before: 'Looks good. ', said: 'Put a short summary at the top', after: ', please.' },
  { project: P.notes!, title: 'Tag search', before: 'Again ', said: 'no summary at the top', after: '.' },
  { project: P.books!, title: 'Search by author', before: 'Fine, but ', said: 'summary first, then the details', after: '.' },
];

// Beats
const SEEN = (i: number) => 38 + i * 30;
const LIFT = 140;
const MERGE = 178;
const INTO = 246;
const RIPPLE = 282;
const SWIPE = { finger: 352, press: 362, drag: 366, release: 394 };

const PHONES = [
  { x: 520, ry: 22 },
  { x: 960, ry: 0 },
  { x: 1400, ry: -22 },
];
const SCALE = 0.72;
const Y = 470;
/** Where the highlighted sentence sits on the frame, roughly, in each phone */
const SAID_AT = (i: number) => ({ x: PHONES[i]!.x + 30, y: Y - 116 });
const PATTERN = { x: 960, y: 400 };

function ChatScreen({ f, i }: { f: number; i: number }) {
  const c = CHATS[i]!;
  const seen = ramp(f, SEEN(i), 12);
  const lifted = f >= LIFT + i * 4;
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: F.body, fontSize: 24, color: C.muted }}>‹</span>
        <ProjectMark project={c.project} size={26} />
        <div>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 19, color: C.ink }}>{c.title}</div>
          <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted }}>{c.project.name}</div>
        </div>
      </div>
      <Bubble mine>Add {c.title.toLowerCase()}.</Bubble>
      <Bubble>Done. Ready for your review.</Bubble>
      <Bubble mine style={{ fontSize: 16, lineHeight: '23px' }}>
        {c.before}
        <span style={{ background: `rgba(201,138,0,${0.6 * seen})`, color: seen > 0.5 ? '#fff' : undefined, borderRadius: 4, padding: '0 2px', opacity: lifted ? 0.25 : 1 }}>{c.said}</span>
        {c.after}
      </Bubble>
      <Bubble>Noted; next time.</Bubble>
    </div>
  );
}

/** The three sentences lifting out of their screens and merging above the phones */
function Lifting({ f }: { f: number }) {
  return (
    <>
      {CHATS.map((c, i) => {
        const t = ramp(f, LIFT + i * 4, MERGE - LIFT - 4, Easing.inOut(Easing.cubic));
        if (t <= 0 || f > MERGE + 10) return null;
        const from = SAID_AT(i);
        const x = mix(t, from.x, PATTERN.x);
        // Each on its own lane until they meet, so the three never cover one another
        const y = mix(t, from.y, PATTERN.y) - (110 + 70 * i) * Math.sin(Math.PI * t);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${1 + 0.6 * Math.sin(Math.PI * t * 0.9)})`,
              background: C.stateUnverified,
              color: '#fff',
              fontFamily: F.body,
              fontWeight: 700,
              fontSize: 20,
              borderRadius: 8,
              padding: '6px 12px',
              whiteSpace: 'nowrap',
              boxShadow: `0 ${20 * t}px 40px rgba(201,138,0,.45)`,
              opacity: 1 - ramp(f, MERGE - 4, 10),
            }}
          >
            {c.said}
          </div>
        );
      })}
    </>
  );
}

/** How many chats said it, counting up above the phones */
function Count({ f }: { f: number }) {
  const n = CHATS.filter((_, i) => f >= SEEN(i)).length;
  if (n === 0 || f > LIFT + 6) return null;
  return (
    <div style={{ position: 'absolute', left: 960, top: 90, transform: `translate(-50%, 0) scale(${1 + 0.25 * (1 - ramp(f, SEEN(n - 1), 10))})`, opacity: 1 - ramp(f, LIFT - 4, 10), display: 'flex', alignItems: 'center', gap: 14, background: C.surface, borderRadius: 999, padding: '10px 26px', boxShadow: '0 12px 30px rgba(30,41,59,.15)' }}>
      <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 46, color: C.stateUnverified }}>{n}×</span>
      <span style={{ fontFamily: F.body, fontSize: 24, color: C.muted }}>the same request</span>
    </div>
  );
}

function PatternCard({ f }: { f: number }) {
  const t = pop(f, MERGE - 4, true);
  const into = ramp(f, INTO, 22, Easing.in(Easing.cubic));
  if (f < MERGE - 4 || into >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: PATTERN.x,
        top: PATTERN.y,
        width: 560,
        transform: `translate(-50%, -50%) translateY(${180 * into}px) scale(${t * mix(into, 1, 0.25)})`,
        opacity: 1 - ramp(f, INTO + 14, 8),
        background: C.surface,
        borderRadius: 24,
        border: `3px solid ${C.stateUnverified}`,
        boxShadow: '0 0 80px rgba(201,138,0,.4), 0 30px 60px rgba(30,41,59,.18)',
        padding: '24px 28px',
      }}
    >
      <TypePill type="Harness/Pattern" size={16} />
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 38, color: C.ink, margin: '12px 0 6px' }}>A summary first, always</div>
      <div style={{ fontFamily: F.body, fontSize: 20, color: C.muted, marginBottom: 12 }}>Seen in 3 chats, across 3 projects</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {CHATS.map((c) => (
          <ProjectMark key={c.project.name} project={c.project} size={30} />
        ))}
      </div>
    </div>
  );
}

const PROPOSAL: Entity = {
  project: { name: 'momentum', color: '#5B5BD6' },
  type: 'Harness/Automation',
  title: 'Every result starts with a summary',
  desc: 'Proposed by optimization from a pattern seen three times.',
  bullets: [],
  state: 'unverified',
};

/** Every project's copy of the definition, turning over as the change reaches it */
const TILES = [
  { project: P.books!, x: 330, y: 300 },
  { project: P.notes!, x: 330, y: 680 },
  { project: P.todo!, x: 1590, y: 300 },
  { project: P.handbook!, x: 1590, y: 680 },
];
const reachAt = (x: number, y: number) => RIPPLE + Math.hypot(x - 960, y - Y) / 26;

function Tiles({ f }: { f: number }) {
  if (f < INTO + 10) return null;
  return (
    <>
      {TILES.map((t, k) => {
        const shown = pop(f, INTO + 10 + k * 4);
        const turn = ramp(f, reachAt(t.x, t.y), 16, Easing.inOut(Easing.cubic));
        const back = turn > 0.5;
        return (
          <div key={t.project.name} style={{ position: 'absolute', left: t.x, top: t.y, transform: `translate(-50%, -50%) perspective(1200px) rotateY(${180 * turn + (back ? 180 : 0)}deg) scale(${shown})` }}>
            <div
              style={{
                width: 440,
                background: C.surface,
                borderRadius: 18,
                border: `3px solid ${back ? C.ok : C.line}`,
                padding: '16px 18px',
                boxShadow: `0 20px 40px rgba(30,41,59,.15), 0 0 ${back ? 30 * (1 - ramp(f, reachAt(t.x, t.y) + 16, 30)) : 0}px ${C.ok}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <ProjectMark project={t.project} size={26} />
                <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 18, color: C.ink, flex: 1 }}>{t.project.name}</span>
                {back ? <Glyph path="M5 12l5 5L20 7" size={24} color={C.ok} stroke /> : null}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted, marginBottom: 8 }}>How work is handed over</div>
              <div style={{ borderRadius: 6, padding: '8px 12px', fontFamily: F.body, fontSize: 19, color: C.ink, background: back ? 'rgba(63,107,82,.25)' : C.card }}>
                {back ? 'Start every result with a short summary.' : 'Hand over the result.'}
              </div>
            </div>
          </div>
        );
      })}
      {/* The ripple carrying the change out from the phone */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[0, 8, 16].map((d) => {
          const r = Math.max(0, (f - RIPPLE - d) * 26);
          return r > 0 && r < 1300 ? <circle key={d} cx={960} cy={Y} r={r} fill="none" stroke={C.ok} strokeWidth={6 - d / 4} opacity={0.5 * (1 - r / 1300)} /> : null;
        })}
      </svg>
    </>
  );
}

/** The narration: a line per beat */
export const LEARN_CUES: Cue[] = [
  { at: 10, hold: 130, text: 'Ask for the same thing again and again,' },
  { at: 142, hold: 240, text: 'and Momentum proposes making it the rule.' },
  { at: 250, hold: 440, text: 'It applies everywhere. You still have the last word.' },
];
const DWELLS = voiceDwells('Learn', LEARN_CUES, LEARN_FRAMES);
export const LEARN_LENGTH = dwelt(LEARN_FRAMES, DWELLS);

export function Learn() {
  const f = dwell(useCurrentFrame(), DWELLS);
  const recede = ramp(f, LIFT, 36, Easing.inOut(Easing.cubic));
  const sides = ramp(f, INTO - 10, 24, Easing.in(Easing.cubic));
  const front = ramp(f, INTO, 26, Easing.inOut(Easing.cubic));
  const landed = pop(f, INTO + 16, true);
  const drag = ramp(f, SWIPE.drag, SWIPE.release - SWIPE.drag, Easing.inOut(Easing.quad)) * 320;
  const away = ramp(f, SWIPE.release, 16, Easing.in(Easing.cubic));
  const approved = f >= SWIPE.release + 16;
  const effect = ramp(f, RIPPLE, 10);
  const centreScale = mix(front, mix(recede, SCALE, 0.6), 0.78);
  const screen = { x: 960 - (PHONE.w / 2) * centreScale + 14 * centreScale, y: Y - (PHONE.h / 2) * centreScale + 14 * centreScale };
  const finger = { x: screen.x + (SLOT.x + SLOT.w / 2 + 20) * centreScale + drag * centreScale, y: screen.y + (SLOT.y + 330) * centreScale };

  return (
    <AbsoluteFill>
      <Voice scene="Learn" cues={LEARN_CUES} dwells={DWELLS} />
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: `960px ${Y}px` }}>
        {PHONES.map((p, i) => {
          const centre = i === 1;
          const enter = pop(f, i * 5);
          const scale = centre ? centreScale : mix(recede, SCALE, 0.6);
          const x = centre ? p.x : mix(sides, mix(recede, p.x, p.x + (i === 0 ? -60 : 60)), p.x + (i === 0 ? -900 : 900));
          const feed = centre && f >= INTO;
          return (
            <Phone
              key={i}
              tab={feed ? 'feed' : 'chat'}
              screen={feed ? null : <ChatScreen f={f} i={i} />}
              style={{
                left: x - PHONE.w / 2,
                top: Y - PHONE.h / 2,
                opacity: enter * (centre ? 1 - 0.55 * recede * (1 - front) : 1 - 0.55 * recede),
                transform: `translateY(${60 * (1 - enter) + 40 * recede * (1 - front)}px) rotateY(${p.ry * (1 - recede)}deg) scale(${scale})`,
              }}
            >
              {feed ? (
                <>
                  <Counters unverified={19 + (approved ? 0 : 1)} verified={40 + (approved ? 1 : 0)} bump={approved ? 1 - ramp(f, SWIPE.release + 16, 12) : 0} />
                  <Behind depth={2} />
                  <Behind depth={1} />
                  {!approved ? (
                    <FeedCard e={PROPOSAL} style={{ transform: `translateY(${-60 * (1 - landed)}px) translateX(${drag + away * 600}px) rotate(${Math.min(10, drag * 0.03)}deg)`, opacity: Math.min(1, landed * 2) * (1 - away) }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ borderRadius: 6, padding: '6px 10px', fontFamily: F.body, fontSize: 14.5, color: C.ink, background: 'rgba(160,64,47,.25)', textDecoration: 'line-through' }}>Hand over the result.</div>
                        <div style={{ borderRadius: 6, padding: '6px 10px', fontFamily: F.body, fontSize: 14.5, color: C.ink, background: 'rgba(63,107,82,.28)' }}>Start every result with a short summary.</div>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, background: C.washOk, color: C.ok, borderRadius: 999, padding: '5px 12px', fontFamily: F.body, fontWeight: 700, fontSize: 14, opacity: effect, transform: `scale(${mix(effect, 0.8, 1)})` }}>
                        <Glyph path={PARTS.bolt} size={16} color={C.ok} stroke />
                        In effect on every project
                      </div>
                      {drag > 0 ? <Stamp kind="ok" label="APPROVE" style={{ left: 22, top: 200, opacity: Math.min(1, drag / 110) }} /> : null}
                    </FeedCard>
                  ) : (
                    <FeedCard e={{ ...PROPOSAL, title: 'Book store', type: 'Architecture/Component', project: P.books!, desc: 'Keeps the books in memory, behind one interface.' }} style={{ transformOrigin: 'top', transform: `scale(${mix(pop(f, SWIPE.release + 16), 0.965, 1)})` }} />
                  )}
                </>
              ) : null}
            </Phone>
          );
        })}
      </AbsoluteFill>
      <Count f={f} />
      <Lifting f={f} />
      <PatternCard f={f} />
      <Tiles f={f} />
      <Finger x={finger.x} y={finger.y} opacity={ramp(f, SWIPE.finger, 8) * (1 - ramp(f, SWIPE.release + 2, 8))} pressed={ramp(f, SWIPE.press, 4) * (1 - ramp(f, SWIPE.release, 4))} />
      <BottomHeadline frame={f} from={4} to={LIFT - 2} tag="Optimization" color={C.stateUnverified} text="The same request, in three chats." />
      <BottomHeadline frame={f} from={LIFT} to={INTO - 2} tag="Optimization" color={C.stateUnverified} text="Seen three times, proposed once." />
      <BottomHeadline frame={f} from={INTO} to={LEARN_FRAMES} tag="Your review" color={C.ok} text="In effect at once. Yours to keep." sub="Every project takes it as it lands; it waits for your swipe." />
    </AbsoluteFill>
  );
}
