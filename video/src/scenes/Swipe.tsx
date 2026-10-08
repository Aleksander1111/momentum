// Scene 2, after the deck's "Mobile App" and "User actions": a swipe right approves and lands one commit, a swipe left
// sends a card back for rework with a comment, a pull up opens a chat on the card.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Behind, Bubble, Button, Counters, FeedCard, Glyph, PHONE, Phone, SLOT, Sheet, Stamp, StateIcon, type Entity } from '../kit/app.tsx';
import { Backdrop, Finger, Headline } from '../kit/stage.tsx';
import { C, F, ICONS, LAYERS } from '../kit/theme.ts';
import { mix, pop, ramp, typed } from '../kit/motion.ts';

export const SWIPE_FRAMES = 540;

const AT = { x: 1150, y: 540 };
const SCREEN0 = { x: AT.x - PHONE.w / 2 + 14, y: AT.y - PHONE.h / 2 + 14 };
const CARD_C = { x: SCREEN0.x + SLOT.x + SLOT.w / 2, y: SCREEN0.y + SLOT.y + SLOT.h / 2 };

const FEATURE: Entity = {
  project: { name: 'notes-api', color: '#0F766E' },
  type: 'Product/Feature',
  title: 'Search notes by tag',
  desc: 'Every note carrying a tag, in one request.',
  bullets: ['GET /notes?tag=work', 'Tags match whatever their case'],
  state: 'unverified',
};
const POLICY: Entity = {
  project: { name: 'handbook', color: '#7C3AED' },
  type: 'Governance/Policy',
  title: 'Leave policy',
  desc: '25 days a year, booked two weeks ahead in the HR tool.',
  bullets: ['Up to 5 days carried over', 'Sick leave reported by 10:00'],
  state: 'unverified',
};

// Beats
const APPROVE = { finger: 20, press: 34, drag: 38, release: 74 };
const LINE = { x0: 1420, x1: 1850, y: 470, dot: 1620 };
const REWORK = { finger: 182, press: 194, drag: 198, release: 222, type: 250, send: 306 };
const COMMENT = 'Add half days, for appointments.';
const ASK = { finger: 368, press: 378, drag: 382, release: 404, type: 426, answer: 452 };
const QUESTION = 'Why half days and not hours?';
const ANSWER = 'Payroll counts leave in half days; hours would need a new export.';

export function Swipe() {
  const f = useCurrentFrame();
  const enter = pop(f, 0);

  // Approve: dragged right, then drawn into its commit on the main line
  const aDrag = ramp(f, APPROVE.drag, APPROVE.release - APPROVE.drag, Easing.inOut(Easing.quad)) * 330;
  const aGo = ramp(f, APPROVE.release, 22, Easing.in(Easing.cubic));
  const target = { x: LINE.dot - CARD_C.x, y: LINE.y - CARD_C.y };
  const approved = f >= APPROVE.release + 22;
  const forward = pop(f, APPROVE.release + 10);

  // Rework: dragged left, the sheet asks why, the card comes back reworked
  const rDrag = ramp(f, REWORK.drag, REWORK.release - REWORK.drag, Easing.inOut(Easing.quad)) * -210;
  const rBack = ramp(f, REWORK.release, 14, Easing.out(Easing.cubic));
  const rDx = rDrag * (1 - rBack);
  const sheet = ramp(f, REWORK.release + 2, 20, Easing.out(Easing.cubic)) * (1 - ramp(f, REWORK.send + 8, 16, Easing.in(Easing.cubic)));
  const sent = f >= REWORK.send + 8;
  const reworked = f >= REWORK.send + 42;

  // Ask: pulled up, the card makes room for its chat below
  const qDrag = ramp(f, ASK.drag, ASK.release - ASK.drag, Easing.inOut(Easing.quad)) * -150;
  const qBack = ramp(f, ASK.release, 16, Easing.out(Easing.cubic));
  const shrink = ramp(f, ASK.release, 18, Easing.inOut(Easing.cubic));
  const chat = ramp(f, ASK.release + 6, 16, Easing.out(Easing.cubic));

  // The finger: one gesture per beat
  const finger = (() => {
    if (f < 160) {
      return { x: CARD_C.x + 30 + aDrag, y: CARD_C.y + 30, o: ramp(f, APPROVE.finger, 10) * (1 - ramp(f, APPROVE.release + 2, 8)), p: ramp(f, APPROVE.press, 4) * (1 - ramp(f, APPROVE.release, 4)) };
    }
    if (f < 360) {
      const onSend = f >= REWORK.send - 20;
      const sendAt = { x: CARD_C.x + 90, y: SCREEN0.y + 760 };
      return onSend
        ? { x: sendAt.x, y: sendAt.y, o: ramp(f, REWORK.send - 20, 8) * (1 - ramp(f, REWORK.send + 8, 8)), p: ramp(f, REWORK.send, 3) * (1 - ramp(f, REWORK.send + 5, 3)) }
        : { x: CARD_C.x + 60 + rDrag, y: CARD_C.y + 60, o: ramp(f, REWORK.finger, 10) * (1 - ramp(f, REWORK.release + 2, 8)), p: ramp(f, REWORK.press, 4) * (1 - ramp(f, REWORK.release, 4)) };
    }
    return { x: CARD_C.x, y: CARD_C.y + 140 + qDrag, o: ramp(f, ASK.finger, 10) * (1 - ramp(f, ASK.release + 2, 8)), p: ramp(f, ASK.press, 4) * (1 - ramp(f, ASK.release, 4)) };
  })();

  const cardH = mix(shrink, SLOT.h, 300);
  const policy = { ...POLICY, state: sent && !reworked ? ('updating' as const) : POLICY.state };
  const inserted = ramp(f, REWORK.send + 42, 14, Easing.out(Easing.cubic));

  // The camera: turning slowly around the phone, leaning in on the sheet and on the chat
  const ry = interpolate(f, [0, 170, 360, SWIPE_FRAMES], [-14, -5, 6, -6], { easing: Easing.inOut(Easing.sin) });
  const zoomSheet = ramp(f, REWORK.type - 16, 24) * (1 - ramp(f, REWORK.send + 10, 24));
  const zoomChat = ramp(f, ASK.release + 10, 30);
  const zoom = 1 + 0.2 * zoomSheet + 0.16 * zoomChat;
  const focus = f < 360 ? { x: AT.x, y: 880 } : { x: AT.x, y: 640 };
  const camera = `translate(${focus.x}px, ${focus.y}px) scale(${zoom}) translate(${-focus.x}px, ${-focus.y}px) translate(${AT.x}px, ${AT.y}px) rotateY(${ry}deg) translate(${-AT.x}px, ${-AT.y}px)`;

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: `${AT.x}px ${AT.y}px` }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: camera, transformStyle: 'preserve-3d' }}>
      <MainLine f={f} />
      <ChatRun f={f} />
      <Phone style={{ left: AT.x - PHONE.w / 2, top: AT.y - PHONE.h / 2, opacity: enter, transform: `translateY(${40 * (1 - enter)}px) scale(${mix(enter, 0.94, 1)})` }}>
        <Counters unverified={23} verified={12 + (approved ? 1 : 0)} bump={approved ? 1 - ramp(f, APPROVE.release + 22, 12) : 0} />
        {!approved ? <Behind depth={2} /> : null}
        <Behind depth={1} style={{ opacity: 1 - shrink }} />
        {approved ? (
          <FeedCard
            e={policy}
            spin={sent && !reworked ? (f - REWORK.send) * 9 : 0}
            style={{
              transformOrigin: 'top',
              transform: `translate(${rDx}px, ${qDrag * (1 - qBack)}px) rotate(${rDx * 0.03}deg) translateY(${-8 * (1 - forward)}px) scale(${mix(forward, 0.965, 1)})`,
              height: cardH,
              overflow: 'hidden',
            }}
          >
            {reworked ? (
              <div style={{ display: 'flex', gap: 8, fontFamily: F.body, fontSize: 14.5, lineHeight: '21px', color: C.ink, opacity: inserted, transform: `translateY(${10 * (1 - inserted)}px)` }}>
                <span>•</span>
                <span style={{ background: 'rgba(63,107,82,.28)', borderRadius: 4, padding: '0 3px' }}>Half days count as 0.5</span>
              </div>
            ) : null}
            {rDrag < 0 ? <Stamp kind="no" label="REWORK" style={{ right: 18, top: 300, opacity: Math.min(1, -rDrag / 100) * (1 - rBack) }} /> : null}
            {qDrag < 0 ? (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, display: 'flex', justifyContent: 'center', opacity: Math.min(1, -qDrag / 80) * (1 - qBack) }}>
                <div style={{ border: `3px solid ${C.accent}`, borderRadius: 6, background: C.surface, padding: '8px 16px', color: C.accent, fontFamily: F.body, fontWeight: 700, letterSpacing: 3, fontSize: 17 }}>ASK</div>
              </div>
            ) : null}
          </FeedCard>
        ) : null}
        {!approved ? (
          <FeedCard
            e={FEATURE}
            style={{
              transform: `translate(${aDrag + target.x * aGo - aDrag * aGo}px, ${target.y * aGo}px) rotate(${Math.min(10, aDrag * 0.03) * (1 - aGo)}deg) scale(${mix(aGo, 1, 0.04)})`,
              opacity: 1 - ramp(f, APPROVE.release + 14, 8),
            }}
          >
            {aDrag > 0 ? <Stamp kind="ok" label="APPROVE" style={{ left: 22, top: 200, opacity: Math.min(1, aDrag / 110) }} /> : null}
          </FeedCard>
        ) : null}
        {chat > 0 ? <CardChat f={f} open={chat} top={SLOT.y + cardH + 12} /> : null}
        {sheet > 0 ? (
          <Sheet rise={sheet}>
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 22, color: C.ink, marginBottom: 12 }}>Rework</div>
            <div
              style={{
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                padding: '12px 14px',
                minHeight: 74,
                fontFamily: F.body,
                fontSize: 15,
                color: f >= REWORK.type ? C.ink : C.muted,
                marginBottom: 14,
              }}
            >
              {f >= REWORK.type ? typed(COMMENT, f, REWORK.type) : 'What should change?'}
              {f >= REWORK.type && f < REWORK.send ? <span style={{ borderLeft: `2px solid ${C.accent}`, marginLeft: 1 }} /> : null}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button label="Cancel" kind="ghost" />
              <Button label="Send back" kind="no" pressed={ramp(f, REWORK.send, 3) * (1 - ramp(f, REWORK.send + 5, 3))} />
            </div>
          </Sheet>
        ) : null}
      </Phone>
      <Finger x={finger.x} y={finger.y} opacity={finger.o} pressed={finger.p} />
      </AbsoluteFill>
      </AbsoluteFill>

      <Headline frame={f} from={4} to={168} tag="Approve" color={C.ok} text="Swipe right to approve." sub="One commit, verified. Work starts by itself." />
      <Headline frame={f} from={172} to={358} tag="Rework" color={LAYERS.attention.ink} text="Swipe left to send it back." sub="Say what should change. A chat run reworks it." />
      <Headline frame={f} from={362} to={SWIPE_FRAMES} tag="Ask" color={C.accent} text="Pull up to ask." sub="A chat on the card, right below it." />
    </AbsoluteFill>
  );
}

/** The main line the approval lands on, and the implementation it starts */
function MainLine({ f }: { f: number }) {
  const draw = ramp(f, APPROVE.release - 4, 24, Easing.out(Easing.cubic));
  const out = ramp(f, 162, 14);
  const dot = pop(f, APPROVE.release + 20, true);
  const arrow = ramp(f, APPROVE.release + 36, 18);
  const chip = pop(f, APPROVE.release + 50, true);
  if (draw <= 0 || out >= 1) return null;
  const x = mix(draw, LINE.x0, LINE.x1);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={LINE.x0} y1={LINE.y} x2={x} y2={LINE.y} stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
        <path d={`M${LINE.dot + 24} ${LINE.y + 24} C ${LINE.dot + 90} ${LINE.y + 60}, ${LINE.dot + 90} ${LINE.y + 100}, ${LINE.dot + 60} ${LINE.y + 138}`} pathLength={1} stroke={C.warn} strokeWidth={4} strokeDasharray={`${0.04} ${0.03}`} strokeDashoffset={0} fill="none" style={{ opacity: arrow, clipPath: `inset(0 ${100 - arrow * 100}% 0 0)` }} />
      </svg>
      {[LINE.x0 + 50, LINE.x0 + 120].map((cx) => (
        <div key={cx} style={{ position: 'absolute', left: cx - 16, top: LINE.y - 16, width: 26, height: 26, borderRadius: 16, border: `5px solid ${C.ink}`, background: C.surface, opacity: draw }} />
      ))}
      <div style={{ position: 'absolute', left: LINE.dot - 30, top: LINE.y - 30, width: 60, height: 60, borderRadius: 30, background: C.ok, transform: `scale(${dot})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${30 * dot}px ${C.ok}` }}>
        <Glyph path={ICONS.check} size={36} color="#fff" />
      </div>
      <div style={{ position: 'absolute', left: LINE.dot - 160, top: LINE.y - 84, width: 320, textAlign: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 24, color: C.ok, opacity: dot }}>
        one commit on the main line
      </div>
      <div
        style={{
          position: 'absolute',
          left: LINE.dot - 40,
          top: LINE.y + 146,
          transform: `scale(${chip})`,
          transformOrigin: 'left center',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: LAYERS.understanding.wash,
          border: `3px solid ${C.warn}`,
          borderRadius: 999,
          padding: '12px 24px 12px 16px',
          fontFamily: F.body,
          fontWeight: 700,
          fontSize: 26,
          color: C.ink,
        }}
      >
        <div style={{ transform: `rotate(${(f - APPROVE.release) * 8}deg)` }}>
          <StateIcon state="updating" size={28} />
        </div>
        Implementing
      </div>
    </div>
  );
}

/** The chat run a send back starts */
function ChatRun({ f }: { f: number }) {
  const t = pop(f, REWORK.send + 14, true);
  const out = ramp(f, 356, 12);
  if (f < REWORK.send + 14 || out >= 1) return null;
  const done = f >= REWORK.send + 42;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1440,
        top: 440,
        transform: `scale(${t})`,
        transformOrigin: 'left center',
        opacity: 1 - out,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: LAYERS.attention.wash,
        border: `3px solid ${C.no}`,
        borderRadius: 999,
        padding: '14px 28px 14px 18px',
        fontFamily: F.body,
        fontWeight: 700,
        fontSize: 28,
        color: C.ink,
      }}
    >
      <Glyph path={ICONS.chat} size={32} color={C.no} />
      Chat run on it
      <div style={{ transform: `rotate(${done ? 0 : (f - REWORK.send) * 9}deg)` }}>
        {done ? <Glyph path="M5 12l5 5L20 7" size={30} color={C.ok} stroke /> : <StateIcon state="updating" size={30} />}
      </div>
    </div>
  );
}

/** The chat below the card: the question typed and sent, the answer streaming in */
function CardChat({ f, open, top }: { f: number; open: number; top: number }) {
  const asked = f >= ASK.type + 26;
  const answer = typed(ANSWER, f, ASK.answer, 40);
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top,
        bottom: 94,
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        padding: '10px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: open,
        transform: `translateY(${30 * (1 - open)}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.muted }}>
        <span style={{ flex: 1 }}>Chat on this card</span>
        <span style={{ fontSize: 20 }}>×</span>
      </div>
      {asked ? <Bubble mine>{QUESTION}</Bubble> : null}
      {answer ? <Bubble>{answer}</Bubble> : null}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.line}`, borderRadius: 12, padding: '9px 12px', fontFamily: F.body, fontSize: 14.5, color: asked || f < ASK.type ? C.muted : C.ink }}>
        <span style={{ flex: 1 }}>{asked || f < ASK.type ? 'Ask about this card' : typed(QUESTION, f, ASK.type, 34)}</span>
        <Glyph path={ICONS.send} size={18} color={C.accent} />
      </div>
    </div>
  );
}
