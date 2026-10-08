// Scene 8, after the deck's "Consistency guard", "Issue types" and "Issue resolution": every write a run makes passes
// the guard; the consistency check finds two cards that contradict each other and raises an issue with options; one
// swipe resolves it and the two cards agree again.
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Behind, Counters, FeedCard, Glyph, PHONE, Phone, SLOT, Stamp, type Entity } from '../kit/app.tsx';
import { DomainBadge } from '../kit/desktop.tsx';
import { Backdrop, Finger, Headline } from '../kit/stage.tsx';
import { C, F, PARTS } from '../kit/theme.ts';
import { mix, pop, ramp } from '../kit/motion.ts';

export const RESOLVE_FRAMES = 450;

const PHONE_AT = { x: 1130, y: 540 };
const SCREEN0 = { x: PHONE_AT.x - PHONE.w / 2 + 14, y: PHONE_AT.y - PHONE.h / 2 + 14 };
const RIGHT = 1650;

// Beats
const WRITE = (i: number) => 14 + i * 16;
const ISSUE = 150;
const PICK = 300;
const SWIPE = { finger: 316, press: 328, drag: 332, release: 362 };
const AGREE = SWIPE.release + 16;

const WRITES: [string, string, boolean][] = [
  ['Architecture/Api', 'Books API', true],
  ['Testing/TestSuite', 'Books API tests', true],
  ['Product/Feature', 'Search by author', true],
  ['Data/Schema', 'Book', true],
  ['Governance/Decision', 'Search in memory', false],
];
const CHECKS = ['type', 'references', 'links'];

/** Each write of a run, checked by the guard as it is made */
function Guard({ f }: { f: number }) {
  const out = ramp(f, ISSUE - 16, 14);
  if (out >= 1) return null;
  const gate = pop(f, 2, true);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out }}>
      <div style={{ position: 'absolute', left: RIGHT, top: 200, transform: `translate(-50%, -50%) scale(${gate})`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 84, height: 84, borderRadius: 42, background: C.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${C.warn}88` }}>
          <Glyph path={PARTS.shield} size={46} color="#fff" stroke />
        </div>
        <div>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, color: C.ink, whiteSpace: 'nowrap' }}>Consistency guard</div>
          <div style={{ fontFamily: F.body, fontSize: 18, color: C.muted, whiteSpace: 'nowrap' }}>{CHECKS.join(' · ')}</div>
        </div>
      </div>
      {WRITES.map(([type, title, ok], i) => {
        const t = pop(f, WRITE(i), true);
        const checked = ramp(f, WRITE(i) + 12, 8);
        return (
          <div
            key={title}
            style={{
              position: 'absolute',
              left: RIGHT - 210,
              top: 300 + i * 82,
              width: 420,
              transform: `translateX(${80 * (1 - t)}px)`,
              opacity: t,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: C.surface,
              border: `2px solid ${checked > 0.5 ? (ok ? C.ok : C.no) : C.line}`,
              borderRadius: 14,
              padding: '10px 14px',
              boxShadow: '0 6px 14px rgba(30,41,59,.1)',
            }}
          >
            <DomainBadge type={type} size={32} />
            <span style={{ flex: 1, fontFamily: F.body, fontWeight: 700, fontSize: 19, color: C.ink }}>{title}</span>
            {checked > 0 ? (
              ok ? (
                <Glyph path="M5 12l5 5L20 7" size={26} color={C.ok} stroke />
              ) : (
                <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: C.no, transform: `scale(${pop(f, WRITE(i) + 12, true)})` }}>unresolved reference</span>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** The two cards that clash, and the issue kinds the check raises */
function Clash({ f }: { f: number }) {
  if (f < ISSUE - 6) return null;
  const t = pop(f, ISSUE);
  const agree = ramp(f, AGREE, 20, Easing.inOut(Easing.cubic));
  const A = { x: RIGHT, y: 270 };
  const B = { x: RIGHT, y: 610 };
  const card = (at: { x: number; y: number }, type: string, title: string, says: string, fixed: string, k: number) => (
    <div
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        width: 400,
        transform: `translate(-50%, -50%) scale(${pop(f, ISSUE + k * 6, true)})`,
        background: C.surface,
        border: `2px solid ${agree > 0.5 ? C.ok : C.no}`,
        borderRadius: 18,
        padding: '16px 18px',
        boxShadow: `0 0 ${30 * (1 - agree)}px ${C.no}55, 0 16px 30px rgba(30,41,59,.12)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <DomainBadge type={type} size={30} />
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 22, color: C.ink }}>{title}</span>
      </div>
      <div style={{ fontFamily: F.body, fontSize: 18, color: C.ink }}>
        {agree > 0.5 && fixed ? (
          <span style={{ background: 'rgba(63,107,82,.28)', borderRadius: 4, padding: '0 3px' }}>{fixed}</span>
        ) : (
          <span style={{ background: agree > 0.5 ? undefined : 'rgba(160,64,47,.22)', borderRadius: 4, padding: '0 3px' }}>{says}</span>
        )}
      </div>
    </div>
  );
  // A zigzag while they clash, a straight line once they agree
  const zig = Array.from({ length: 9 }, (_, i) => `${A.x + (i % 2 ? 22 : -22) * (1 - agree)} ${A.y + 80 + i * ((B.y - A.y - 160) / 8)}`).join(' L ');
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: t }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M ${zig}`} stroke={agree > 0.5 ? C.ok : C.no} strokeWidth={5} fill="none" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ramp(f, ISSUE + 10, 16)} />
      </svg>
      {card(A, 'Governance/Policy', 'Remote work policy', 'Up to three remote days a week.', '', 0)}
      {card(B, 'Knowledge/HowToGuide', 'Onboarding guide', 'Two remote days a week.', 'Three remote days a week.', 1)}
      <div style={{ position: 'absolute', left: RIGHT, top: 440, transform: `translate(-50%, -50%) scale(${pop(f, ISSUE + 20, true)})` }}>
        <div style={{ background: agree > 0.5 ? C.ok : C.no, color: '#fff', borderRadius: 999, padding: '8px 18px', fontFamily: F.body, fontWeight: 700, fontSize: 20, whiteSpace: 'nowrap' }}>
          {agree > 0.5 ? 'Consistent' : 'High · Contradiction'}
        </div>
      </div>
      <Kinds f={f} />
    </div>
  );
}

const KINDS: [string, string, string[]][] = [
  ['High', C.no, ['Contradiction', 'Logical', 'Ambiguity']],
  ['Medium', C.warn, ['Design gap', 'Naming', 'Repetition']],
  ['Low', C.muted, ['Verbose', 'Struct', 'Split']],
];

function Kinds({ f }: { f: number }) {
  return (
    <div style={{ position: 'absolute', left: RIGHT - 230, top: 790, width: 460, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {KINDS.map(([level, color, kinds], r) => (
        <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 70, fontFamily: F.body, fontWeight: 700, fontSize: 15, color }}>{level}</span>
          {kinds.map((k, i) => {
            const t = pop(f, ISSUE + 40 + r * 6 + i * 2, true);
            const lit = k === 'Contradiction';
            return (
              <span key={k} style={{ transform: `scale(${t})`, background: lit ? color : color + '1F', color: lit ? '#fff' : color, borderRadius: 999, padding: '3px 12px', fontFamily: F.body, fontWeight: 700, fontSize: 14 }}>
                {k}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const WAITING: Entity = {
  project: { name: 'todo-cli', color: '#C2410C' },
  type: 'Product/Feature',
  title: 'Due dates',
  desc: 'A to-do can be due on a day; overdue ones come first.',
  bullets: ['todo due <id> 2026-11-01'],
  state: 'unverified',
};

const ISSUE_CARD: Entity = {
  project: { name: 'handbook', color: '#7C3AED' },
  type: 'Harness/Issue',
  title: 'Remote days: three or two?',
  desc: 'The remote work policy allows three days a week; the onboarding guide says two.',
  bullets: [],
  state: 'unverified',
};
const OPTIONS: [string, string][] = [
  ['Three days', 'The guide follows the policy.'],
  ['Two days', 'The policy follows the guide.'],
  ['Ask People Ops', 'Both stay; a question goes out.'],
];

function Options({ f }: { f: number }) {
  const press = f >= PICK && f < PICK + 8 ? Math.sin((Math.PI * (f - PICK)) / 8) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 8 }}>Resolve</div>
      {OPTIONS.map(([label, change], i) => {
        const on = i === 0;
        return (
          <div key={label} style={{ display: 'flex', gap: 10, border: `1px solid ${on ? C.ok : C.line}`, background: on ? C.washOk : C.surface, borderRadius: 12, padding: '9px 12px', marginBottom: 8, transform: on ? `scale(${1 - 0.03 * press})` : undefined }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, marginTop: 2, boxSizing: 'border-box', border: `${on ? 5 : 2}px solid ${on ? C.ok : C.line}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 14.5, color: C.ink }}>
                {label}
                {on ? <span style={{ color: C.ok, fontSize: 10.5, letterSpacing: 1.2 }}>{'  RECOMMENDED'}</span> : null}
              </div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 }}>{change}</div>
            </div>
          </div>
        );
      })}
      <div style={{ fontFamily: F.body, fontSize: 12, fontStyle: 'italic', color: C.muted, textAlign: 'center' }}>swipe right to resolve · left for your own</div>
    </div>
  );
}

export function Resolve() {
  const f = useCurrentFrame();
  const enter = pop(f, 0);
  const landed = pop(f, ISSUE + 30, true);
  const drag = ramp(f, SWIPE.drag, SWIPE.release - SWIPE.drag, Easing.inOut(Easing.quad)) * 320;
  const away = ramp(f, SWIPE.release, 16, Easing.in(Easing.cubic));
  const resolved = f >= SWIPE.release + 16;
  const cardC = { x: SCREEN0.x + SLOT.x + SLOT.w / 2, y: SCREEN0.y + SLOT.y + SLOT.h / 2 };
  const onPick = f < SWIPE.finger + 6;
  const finger = onPick
    ? { x: cardC.x - 60, y: SCREEN0.y + SLOT.y + 300, o: ramp(f, PICK - 14, 8), p: f >= PICK && f < PICK + 8 ? 1 : 0 }
    : { x: cardC.x + drag, y: cardC.y + 120, o: 1 - ramp(f, SWIPE.release + 2, 8), p: ramp(f, SWIPE.press, 4) * (1 - ramp(f, SWIPE.release, 4)) };
  return (
    <AbsoluteFill>
      <Backdrop />
      <Guard f={f} />
      <Clash f={f} />
      <Phone style={{ left: PHONE_AT.x - PHONE.w / 2, top: PHONE_AT.y - PHONE.h / 2, opacity: enter, transform: `translateY(${40 * (1 - enter)}px) perspective(2000px) rotateY(-8deg)` }}>
        <Counters unverified={21} verified={40 + (resolved ? 2 : 0)} bump={resolved ? 1 - ramp(f, SWIPE.release + 16, 12) : 0} />
        <Behind depth={2} />
        <Behind depth={1} />
        {f < ISSUE + 40 ? <FeedCard e={WAITING} /> : null}
        {f >= ISSUE + 30 && !resolved ? (
          <FeedCard
            e={ISSUE_CARD}
            style={{
              transform: `translateY(${-70 * (1 - landed)}px) translateX(${drag + away * 600}px) rotate(${Math.min(10, drag * 0.03)}deg)`,
              opacity: Math.min(1, landed * 2) * (1 - away),
              boxShadow: `0 0 ${40 * (1 - ramp(f, ISSUE + 30, 40))}px ${C.no}`,
            }}
          >
            <Options f={f} />
            {drag > 0 ? <Stamp kind="ok" label="RESOLVE" style={{ left: 22, top: 140, opacity: Math.min(1, drag / 110) }} /> : null}
          </FeedCard>
        ) : null}
        {resolved ? (
          <FeedCard
            e={{ ...ISSUE_CARD, type: 'Knowledge/HowToGuide', title: 'Onboarding guide', desc: 'The first week of a new joiner, day by day.', bullets: ['Three remote days a week, as the policy says'] }}
            style={{ transform: `scale(${mix(pop(f, SWIPE.release + 16), 0.965, 1)})`, transformOrigin: 'top' }}
          />
        ) : null}
      </Phone>
      <Finger x={finger.x} y={finger.y} opacity={f >= PICK - 14 ? finger.o : 0} pressed={finger.p} />
      <Headline frame={f} from={2} to={ISSUE - 4} tag="Consistency guard" color={C.warn} text="Every change, checked." sub="What fails becomes an issue, never a silent error." />
      <Headline frame={f} from={ISSUE} to={PICK - 4} tag="Consistency check" color={C.no} text="Contradictions surface." sub="Each with options; the best one picked for you." />
      <Headline frame={f} from={PICK} to={RESOLVE_FRAMES} tag="Resolution" color={C.ok} text="One swipe resolves it." sub="A run applies it to every card concerned." />
    </AbsoluteFill>
  );
}
