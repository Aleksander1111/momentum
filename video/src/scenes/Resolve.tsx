// Scene 8, after the deck's "Consistency guard", "Issue types" and "Issue resolution": a versus screen. Two cards rush
// in from either side and collide on a diagonal seam, their sentences contradicting each other; the seam cracks. The
// crack opens on an extreme close-up of the phone, where the issue's recommended option is picked and swiped; the halves
// close, the crack zips shut and the two cards agree.
import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { Behind, Counters, FeedCard, PHONE, Phone, SLOT, Stamp, type Entity } from '../kit/app.tsx';
import { DomainBadge } from '../kit/desktop.tsx';
import { Backdrop, Finger } from '../kit/stage.tsx';
import { C, F, LAYERS } from '../kit/theme.ts';
import { dwelt, mix, pop, ramp, typed, useSceneFrame } from '../kit/motion.ts';
import { type Cue, Voice, voiceDwells } from '../kit/voice.tsx';

export const RESOLVE_FRAMES = 392;

// Beats
const IN = 22;
const HIT = 44;
const OPEN = { from: 120, to: 148 };
const PICK = 184;
const SWIPE = { drag: 206, release: 236 };
const CLOSE = { from: 262, to: 290 };
const ZIP = 292;

// The seam: a diagonal from the top a little right of centre to the bottom a little left of it
const SEAM = { top: 1056, bottom: 864 };
const CRACK = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 18; i++) {
    const y = (1080 * i) / 18;
    // A clean cut, not a torn edge
    const x = mix(i / 18, SEAM.top, SEAM.bottom);
    pts.push([x, y]);
  }
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
})();

const PHONE_AT = { x: 960, y: 540, scale: 1.02, rz: -3 };

const ISSUE: Entity = {
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

/** One side of the versus screen: a card filling its half, its sentence large */
function Half({ f, side }: { f: number; side: 'left' | 'right' }) {
  const left = side === 'left';
  const enter = ramp(f, 0, IN, Easing.out(Easing.cubic));
  const open = ramp(f, OPEN.from, OPEN.to - OPEN.from, Easing.inOut(Easing.cubic)) * (1 - ramp(f, CLOSE.from, CLOSE.to - CLOSE.from, Easing.inOut(Easing.cubic)));
  const shake = f >= HIT && f < HIT + 16 ? Math.sin(f * 2.2) * 7 * (1 - (f - HIT) / 16) : 0;
  const agreed = f >= ZIP;
  const fixed = ramp(f, ZIP + 4, 26);
  const layer = left ? LAYERS.attention : LAYERS.understanding;
  const clip = left ? `polygon(0 0, ${SEAM.top}px 0, ${SEAM.bottom}px 100%, 0 100%)` : `polygon(${SEAM.top}px 0, 100% 0, 100% 100%, ${SEAM.bottom}px 100%)`;
  const dx = (left ? -1 : 1) * (1920 * (1 - enter) + 470 * open) + shake * (left ? 1 : -1);
  const style: CSSProperties = { clipPath: clip, transform: `translateX(${dx}px)`, background: agreed ? `linear-gradient(${left ? 120 : 240}deg, ${layer.wash}, ${C.washOk})` : layer.wash };
  const card = { x: left ? 470 : 1450 };
  return (
    <AbsoluteFill style={style}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at ${left ? 30 : 70}% 50%, rgba(255,255,255,.55), transparent 60%)` }} />
      <div style={{ position: 'absolute', left: card.x, top: 540, width: 640, opacity: 1 - Math.min(1, open * 2.5), transform: `translate(-50%, -50%) rotate(${left ? -2 : 2}deg) scale(${mix(pop(f, IN - 6, true), 0.9, 1)})` }}>
        <div style={{ background: C.surface, borderRadius: 28, padding: '30px 34px', boxShadow: `0 40px 80px rgba(30,41,59,.2), 0 0 ${agreed ? 50 * fixed : 0}px ${C.ok}`, border: `4px solid ${agreed ? C.ok : f >= HIT ? C.no : C.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <DomainBadge type={left ? 'Governance/Policy' : 'Knowledge/HowToGuide'} size={54} />
            <div>
              <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 40, color: C.ink }}>{left ? 'Remote work policy' : 'Onboarding guide'}</div>
              <div style={{ fontFamily: F.body, fontSize: 20, color: C.muted }}>handbook</div>
            </div>
          </div>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 58, lineHeight: 1.1, color: C.ink }}>
            {left || !agreed ? (
              <span style={{ background: f >= HIT && !agreed ? 'rgba(160,64,47,.22)' : agreed ? 'rgba(63,107,82,.22)' : 'transparent', borderRadius: 8, padding: '0 6px' }}>{left ? 'Three' : 'Two'}</span>
            ) : (
              <span style={{ background: 'rgba(63,107,82,.28)', borderRadius: 8, padding: '0 6px' }}>
                <span style={{ textDecoration: 'line-through', color: C.no, opacity: 1 - fixed, fontSize: 58 * (1 - fixed) + 1 }}>Two</span>
                {typed('Three', f, ZIP + 8, 12)}
              </span>
            )}{' '}
            remote days a week.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** The crack along the seam: drawn as the cards hit, glowing red, then zipped shut in green */
function Crack({ f }: { f: number }) {
  if (f < HIT) return null;
  const drawn = ramp(f, HIT, 22, Easing.out(Easing.cubic));
  const open = ramp(f, OPEN.from, 12) * (1 - ramp(f, CLOSE.to - 6, 6));
  const zip = ramp(f, ZIP, 26, Easing.inOut(Easing.cubic));
  const gone = ramp(f, ZIP + 40, 20);
  const color = zip > 0 ? C.ok : C.no;
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: (1 - open) * (1 - gone), pointerEvents: 'none' }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <path d={CRACK} stroke={color} strokeWidth={22} fill="none" opacity={0.5} filter="url(#glow)" pathLength={1} strokeDasharray="1" strokeDashoffset={zip > 0 ? 0 : 1 - drawn} />
      <path d={CRACK} stroke={zip > 0 ? C.ok : C.ink} strokeWidth={zip > 0 ? 8 : 6} fill="none" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={zip > 0 ? 0 : 1 - drawn} />
      {zip > 0 ? <path d={CRACK} stroke="#fff" strokeWidth={10} fill="none" pathLength={1} strokeDasharray={`${zip} 1`} /> : null}
    </svg>
  );
}

function Options({ f }: { f: number }) {
  const press = f >= PICK && f < PICK + 8 ? Math.sin((Math.PI * (f - PICK)) / 8) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 8 }}>Resolve</div>
      {OPTIONS.map(([label, change], i) => {
        const on = i === 0;
        return (
          <div key={label} style={{ display: 'flex', gap: 10, border: `1px solid ${on ? C.ok : C.line}`, background: on ? C.washOk : C.surface, borderRadius: 12, padding: '9px 12px', marginBottom: 8, transform: on ? `scale(${1 - 0.04 * press})` : undefined }}>
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

/** A slanted ribbon across the frame carrying the line of each beat */
function Banner({ f, from, to, text, color }: { f: number; from: number; to: number; text: string; color: string }) {
  if (f < from || f > to) return null;
  const t = ramp(f, from, 12, Easing.out(Easing.cubic)) * (1 - ramp(f, to - 10, 10, Easing.in(Easing.cubic)));
  return (
    <div style={{ position: 'absolute', left: -40, right: -40, top: 880, transform: `rotate(-4deg) translateX(${(1 - t) * -400}px)`, opacity: t, background: color, padding: '18px 0', textAlign: 'center', boxShadow: '0 20px 40px rgba(30,41,59,.25)' }}>
      <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 64, color: '#fff', letterSpacing: 1 }}>{text}</span>
    </div>
  );
}

/** The narration: a line per beat */
export const RESOLVE_CUES: Cue[] = [
  { at: 30, hold: 112, text: 'When two documents disagree, Momentum notices.' },
  { at: 150, hold: 200, text: 'It suggests a fix, best option first.' },
  { at: 226, hold: 300, text: 'One swipe, and they agree again.' },
];
const DWELLS = voiceDwells('Resolve', RESOLVE_CUES, RESOLVE_FRAMES);
export const RESOLVE_LENGTH = dwelt(RESOLVE_FRAMES, DWELLS);

export function Resolve() {
  const f = useSceneFrame(DWELLS);
  const drag = ramp(f, SWIPE.drag, SWIPE.release - SWIPE.drag, Easing.inOut(Easing.quad)) * 300;
  const away = ramp(f, SWIPE.release, 16, Easing.in(Easing.cubic));
  const resolved = f >= SWIPE.release + 16;
  const s = PHONE_AT.scale;
  const screen0 = { x: PHONE_AT.x - (PHONE.w / 2 - 14) * s, y: PHONE_AT.y - (PHONE.h / 2 - 14) * s };
  const finger = f < PICK + 14 ? { x: screen0.x + 150 * s, y: screen0.y + (SLOT.y + 250) * s } : { x: screen0.x + (SLOT.x + SLOT.w / 2) * s + drag * s, y: screen0.y + (SLOT.y + 260) * s };
  const fingerShown = ramp(f, PICK - 14, 8) * (1 - ramp(f, SWIPE.release + 2, 8));
  const pressed = (f >= PICK && f < PICK + 8 ? 1 : 0) + ramp(f, SWIPE.drag - 4, 4) * (1 - ramp(f, SWIPE.release, 4));
  const hitFlash = f >= HIT && f < HIT + 10 ? 1 - (f - HIT) / 10 : 0;
  const stamp = pop(f, HIT + 4, true) * (1 - ramp(f, OPEN.from - 6, 8));
  return (
    <AbsoluteFill>
      <Voice scene="Resolve" cues={RESOLVE_CUES} dwells={DWELLS} />
      <Backdrop />
      {/* The phone, close up, waiting behind the seam */}
      <Phone style={{ left: PHONE_AT.x - PHONE.w / 2, top: PHONE_AT.y - PHONE.h / 2, transform: `rotate(${PHONE_AT.rz}deg) scale(${s * mix(ramp(f, OPEN.from, 40), 0.92, 1)})` }}>
        <Counters unverified={21} verified={40 + (resolved ? 2 : 0)} bump={resolved ? 1 - ramp(f, SWIPE.release + 16, 12) : 0} />
        <Behind depth={2} />
        <Behind depth={1} />
        {!resolved ? (
          <FeedCard e={ISSUE} style={{ transform: `translateX(${drag + away * 600}px) rotate(${Math.min(10, drag * 0.03)}deg)`, opacity: 1 - away }}>
            <Options f={f} />
            {drag > 0 ? <Stamp kind="ok" label="RESOLVE" style={{ left: 22, top: 140, opacity: Math.min(1, drag / 100) }} /> : null}
          </FeedCard>
        ) : null}
      </Phone>
      <Finger x={finger.x} y={finger.y} opacity={fingerShown} pressed={Math.min(1, pressed)} />
      <Half f={f} side="left" />
      <Half f={f} side="right" />
      <Crack f={f} />
      <AbsoluteFill style={{ background: '#fff', opacity: 0.3 * hitFlash, pointerEvents: 'none' }} />
      {stamp > 0 ? (
        <div style={{ position: 'absolute', left: 960, top: 300, transform: `translate(-50%, -50%) rotate(-8deg) scale(${stamp})`, border: `6px solid ${C.no}`, borderRadius: 12, background: C.surface, padding: '14px 30px', fontFamily: F.body, fontWeight: 700, fontSize: 44, letterSpacing: 6, color: C.no, boxShadow: '0 20px 40px rgba(30,41,59,.25)' }}>
          CONTRADICTION
        </div>
      ) : null}
      {f >= ZIP + 10 ? (
        <div style={{ position: 'absolute', left: 960, top: 300, transform: `translate(-50%, -50%) scale(${pop(f, ZIP + 10, true)})`, background: C.ok, borderRadius: 999, padding: '14px 34px', fontFamily: F.body, fontWeight: 700, fontSize: 40, color: '#fff', boxShadow: `0 0 40px ${C.ok}` }}>
          Consistent · 0 contradictions
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 54, textAlign: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 22, letterSpacing: 6, color: C.ink, opacity: ramp(f, 6, 10) * (1 - ramp(f, OPEN.from, 8)) + ramp(f, CLOSE.to, 8) }}>CONSISTENCY CHECK</div>
      <Banner f={f} from={HIT + 10} to={OPEN.from + 4} text="Two cards disagree." color={C.no} />
      <Banner f={f} from={OPEN.to} to={CLOSE.from} text="Pick an option. Swipe." color={C.ink} />
      <Banner f={f} from={ZIP + 16} to={RESOLVE_FRAMES} text="One swipe, and they agree." color={C.ok} />
    </AbsoluteFill>
  );
}
