// Scene 6, after the deck's "Automation management": optimization notices one request repeated across three chats,
// raises it as a pattern, and the definition change it proposes is in effect on every project as it lands, waiting in
// the feed for your review.
import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Behind, Bubble, Counters, FeedCard, Glyph, PHONE, Phone, ProjectMark, SLOT, Stamp, TypePill, type Entity, type Project } from '../kit/app.tsx';
import { Backdrop, Finger, Headline } from '../kit/stage.tsx';
import { C, F } from '../kit/theme.ts';
import { mix, pop, ramp } from '../kit/motion.ts';

export const LEARN_FRAMES = 420;

const P: Record<string, Project> = {
  todo: { name: 'todo-cli', color: '#C2410C' },
  notes: { name: 'notes-api', color: '#0F766E' },
  books: { name: 'bookshelf-api', color: '#1D6FD6' },
  handbook: { name: 'handbook', color: '#7C3AED' },
};

const CHATS: { project: Project; title: string; before: string; said: string; after: string; at: [number, number] }[] = [
  { project: P.todo!, title: 'Due dates', before: 'Looks good. ', said: 'Run the tests before you commit', after: ', please.', at: [1650, 260] },
  { project: P.notes!, title: 'Tag search', before: 'You committed again ', said: 'without running the tests', after: '.', at: [1650, 500] },
  { project: P.books!, title: 'Search by author', before: 'Fine, but ', said: 'tests first, then the commit', after: '.', at: [1650, 740] },
];

// Beats
const SEEN = (i: number) => 40 + i * 34;
const MERGE = 160;
const PATTERN = 186;
const INTO_FEED = 236;
const EFFECT = 262;
const APPROVE = { finger: 318, press: 330, drag: 334, release: 364 };

const CENTER = { x: 1650, y: 500 };
const PHONE_AT = { x: 1220, y: 540 };

function ChatCard({ f, i }: { f: number; i: number }) {
  const c = CHATS[i]!;
  const shown = pop(f, 10 + i * 8);
  const seen = ramp(f, SEEN(i), 12);
  const merge = ramp(f, MERGE + i * 3, 22, Easing.inOut(Easing.cubic));
  const x = mix(merge, c.at[0], CENTER.x);
  const y = mix(merge, c.at[1], CENTER.y);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 400,
        transform: `translate(-50%, -50%) translateX(${-260 * (1 - shown)}px) perspective(1800px) rotateY(${mix(merge, -14, 0)}deg) scale(${shown * mix(merge, 1, 0.5)})`,
        opacity: shown * (1 - ramp(f, MERGE + 16, 10)),
        background: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.line}`,
        boxShadow: '0 20px 50px rgba(30,41,59,.15)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ProjectMark project={c.project} size={22} />
        <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: C.muted }}>{c.project.name}</span>
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 17, color: C.ink, marginLeft: 4 }}>{c.title}</span>
      </div>
      <Bubble style={{ fontSize: 16 }}>Implemented; 12 tests added.</Bubble>
      <Bubble mine style={{ fontSize: 16, lineHeight: '23px' }}>
        {c.before}
        <span style={{ background: `rgba(201,138,0,${0.55 * seen})`, borderRadius: 4, padding: '0 2px', color: seen > 0.5 ? '#fff' : undefined }}>{c.said}</span>
        {c.after}
      </Bubble>
      <div
        style={{
          position: 'absolute',
          right: -16,
          top: -16,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: C.stateUnverified,
          color: '#fff',
          fontFamily: F.body,
          fontWeight: 700,
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pop(f, SEEN(i), true)})`,
        }}
      >
        {i + 1}×
      </div>
    </div>
  );
}

/** The pattern optimization raises, with its evidence */
function PatternCard({ f }: { f: number }) {
  const t = pop(f, PATTERN - 8, true);
  const into = ramp(f, INTO_FEED, 20, Easing.in(Easing.cubic));
  if (f < PATTERN - 8 || into >= 1) return null;
  const target = { x: PHONE_AT.x - CENTER.x, y: PHONE_AT.y - 40 - CENTER.y };
  return (
    <div
      style={{
        position: 'absolute',
        left: CENTER.x,
        top: CENTER.y,
        width: 470,
        transform: `translate(-50%, -50%) translate(${target.x * into}px, ${target.y * into}px) scale(${t * mix(into, 1, 0.3)})`,
        opacity: 1 - ramp(f, INTO_FEED + 12, 8),
        background: C.surface,
        borderRadius: 22,
        border: `2px solid ${C.stateUnverified}`,
        boxShadow: `0 0 60px rgba(201,138,0,.35), 0 30px 60px rgba(30,41,59,.15)`,
        padding: '22px 24px',
      }}
    >
      <TypePill type="Harness/Pattern" size={15} />
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 32, color: C.ink, margin: '12px 0 6px' }}>Tests before every commit</div>
      <div style={{ fontFamily: F.body, fontSize: 18, color: C.muted, marginBottom: 14 }}>Seen in 3 chats, across 3 projects</div>
      {CHATS.map((c) => (
        <div key={c.project.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontFamily: F.body, fontSize: 16, color: C.ink }}>
          <ProjectMark project={c.project} size={20} />“{c.said}”
        </div>
      ))}
    </div>
  );
}

const PROPOSAL: Entity = {
  project: { name: 'momentum', color: '#5B5BD6' },
  type: 'Harness/Automation',
  title: 'Implementation: tests before the commit',
  desc: 'Proposed by optimization from a pattern seen three times.',
  bullets: [],
  state: 'unverified',
};

function Diff() {
  const line = (mark: 'del' | 'ins', text: string): CSSProperties & { text: string } => ({ text, background: mark === 'ins' ? 'rgba(63,107,82,.28)' : 'rgba(160,64,47,.28)', textDecoration: mark === 'del' ? 'line-through' : undefined });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {[line('del', 'Commit when the work is done.'), line('ins', 'Run the tests; commit only when they pass.')].map(({ text, ...style }) => (
        <div key={text} style={{ ...style, borderRadius: 6, padding: '6px 10px', fontFamily: F.body, fontSize: 14.5, color: C.ink }}>
          {text}
        </div>
      ))}
      <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted, marginTop: 6 }}>agents/momentum-implementation.md</div>
    </div>
  );
}

/** Every project taking the change as it lands */
function InEffect({ f }: { f: number }) {
  const projects = Object.values(P);
  return (
    <>
      {projects.map((p, i) => {
        const t = pop(f, EFFECT + i * 5, true);
        const y = 300 + i * 150;
        const x = 1640;
        return (
          <div key={p.name}>
            <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
              <path d={`M ${PHONE_AT.x + 200} ${PHONE_AT.y - 60} C ${PHONE_AT.x + 300} ${PHONE_AT.y - 60}, ${x - 140} ${y}, ${x - 30} ${y}`} pathLength={1} stroke={C.ok} strokeWidth={3} strokeDasharray="1" strokeDashoffset={1 - ramp(f, EFFECT - 6 + i * 5, 14)} fill="none" opacity={0.6} />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: `translateY(-50%) scale(${t})`,
                transformOrigin: 'left center',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: C.surface,
                border: `2px solid ${C.ok}`,
                borderRadius: 999,
                padding: '8px 18px 8px 8px',
                fontFamily: F.body,
                fontWeight: 700,
                fontSize: 20,
                color: C.ink,
                boxShadow: '0 10px 24px rgba(30,41,59,.12)',
              }}
            >
              <ProjectMark project={p} size={30} />
              {p.name}
              <Glyph path="M5 12l5 5L20 7" size={22} color={C.ok} stroke />
            </div>
          </div>
        );
      })}
    </>
  );
}

export function Learn() {
  const f = useCurrentFrame();
  const phoneIn = pop(f, 0);
  const landed = pop(f, INTO_FEED + 14, true);
  const drag = ramp(f, APPROVE.drag, APPROVE.release - APPROVE.drag, Easing.inOut(Easing.quad)) * 320;
  const away = ramp(f, APPROVE.release, 16, Easing.in(Easing.cubic));
  const approved = f >= APPROVE.release + 16;
  const effect = ramp(f, EFFECT, 10);
  const screen = { x: PHONE_AT.x - PHONE.w / 2 + 14, y: PHONE_AT.y - PHONE.h / 2 + 14 };
  const fingerAt = { x: screen.x + SLOT.x + SLOT.w / 2 + 20 + drag, y: screen.y + SLOT.y + 330 };

  return (
    <AbsoluteFill>
      <Backdrop />
      {CHATS.map((_, i) => (
        <ChatCard key={i} f={f} i={i} />
      ))}
      {f >= EFFECT - 10 ? <InEffect f={f} /> : null}
      {(
        <>
          <Phone tab={f < INTO_FEED ? 'chat' : 'feed'} screen={f < INTO_FEED ? <Sessions f={f} /> : null} style={{ left: PHONE_AT.x - PHONE.w / 2, top: PHONE_AT.y - PHONE.h / 2, opacity: phoneIn, transform: `translateY(${40 * (1 - phoneIn)}px) perspective(2000px) rotateY(-8deg)` }}>
            {f >= INTO_FEED ? <Counters unverified={19 + (f >= INTO_FEED + 14 ? 1 : 0) - (approved ? 1 : 0)} verified={40 + (approved ? 1 : 0)} bump={approved ? 1 - ramp(f, APPROVE.release + 16, 12) : 0} /> : null}
            {f >= INTO_FEED ? <Behind depth={2} /> : null}
            {f >= INTO_FEED ? <Behind depth={1} /> : null}
            {f >= INTO_FEED + 14 && !approved ? (
              <FeedCard
                e={PROPOSAL}
                style={{
                  transform: `translateY(${-60 * (1 - landed)}px) translateX(${drag + away * 600}px) rotate(${Math.min(10, drag * 0.03)}deg)`,
                  opacity: Math.min(1, landed * 2) * (1 - away),
                }}
              >
                <Diff />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, background: C.washOk, color: C.ok, borderRadius: 999, padding: '5px 12px', fontFamily: F.body, fontWeight: 700, fontSize: 14, opacity: effect, transform: `scale(${mix(effect, 0.8, 1)})` }}>
                  <Glyph path="M13 2L4 14h7l-1 8 9-12h-7z" size={16} color={C.ok} stroke />
                  In effect on every project
                </div>
                {drag > 0 ? <Stamp kind="ok" label="APPROVE" style={{ left: 22, top: 200, opacity: Math.min(1, drag / 110) }} /> : null}
              </FeedCard>
            ) : null}
          </Phone>
          <Finger x={fingerAt.x} y={fingerAt.y} opacity={ramp(f, APPROVE.finger, 10) * (1 - ramp(f, APPROVE.release + 2, 8))} pressed={ramp(f, APPROVE.press, 4) * (1 - ramp(f, APPROVE.release, 4))} />
        </>
      )}
      <PatternCard f={f} />
      <Headline frame={f} from={2} to={INTO_FEED - 4} tag="Optimization" color={C.stateUnverified} text="It learns what repeats." sub="Seen three times, proposed once." />
      <Headline frame={f} from={INTO_FEED} to={LEARN_FRAMES} tag="Your review" color={C.ok} text="In effect at once. Yours to keep." sub="Every change still waits for your swipe." />
    </AbsoluteFill>
  );
}

/** The phone's Sessions tab: each chat's row lights up as optimization reads the request in it */
function Sessions({ f }: { f: number }) {
  const rows = [
    ...CHATS.map((c, i) => ({ project: c.project, title: c.title, last: c.before + c.said + c.after, seen: ramp(f, SEEN(i), 12) })),
    { project: P.handbook!, title: 'Onboarding guide', last: 'Add the first-week checklist.', seen: 0 },
    { project: P.books!, title: 'Book store', last: 'Why is the store in memory?', seen: 0 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0' }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 12 }}>Sessions</div>
      {rows.map((r) => (
        <div
          key={r.title}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: r.seen > 0 ? `rgba(201,138,0,${0.16 * r.seen})` : C.surface,
            border: `1px solid ${r.seen > 0.5 ? C.stateUnverified : C.line}`,
            borderRadius: 14,
            padding: '12px',
            marginBottom: 8,
          }}
        >
          <ProjectMark project={r.project} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: C.ink }}>{r.title}</div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.last}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
