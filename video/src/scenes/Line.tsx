// Scene 9, after the deck's "Settings", and the close: the phone's Settings tune how much reaches you, over giant
// words; the camera pulls back on a wall of every screen of the app, and the logo.
import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { Behind, Bubble, Counters, FeedCard, Glyph, PHONE, Phone, type Entity } from '../kit/app.tsx';
import { Desktop, DomainBadge, StateBadge } from '../kit/desktop.tsx';
import { Backdrop, Logo, TopHeadline } from '../kit/stage.tsx';
import { C, F, ICONS, PARTS } from '../kit/theme.ts';
import { dwelt, mix, pop, ramp, useSceneFrame } from '../kit/motion.ts';
import { type Cue, useDrift, Voice, voiceDwells } from '../kit/voice.tsx';

export const LINE_FRAMES = 358;

// Beats
const SETTINGS = 0;
const WALL = 158;
const LOGO = 252;

/** The phone's Settings, tuned live: the feed's size, concurrent runs, models by risk */
function SettingsScreen({ f }: { f: number }) {
  const feed = Math.round(mix(ramp(f, SETTINGS + 34, 40), 40, 25));
  const runs = f >= SETTINGS + 92 ? 4 : f >= SETTINGS + 80 ? 6 : 8;
  const risk = f >= SETTINGS + 112;
  const row = (title: string, body: ReactNode, sub?: string) => (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: sub ? 2 : 10 }}>{title}</div>
      {sub ? <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted, marginBottom: 10 }}>{sub}</div> : null}
      {body}
    </div>
  );
  const segmented = (options: string[], on: number) => (
    <div style={{ display: 'flex', background: C.card, borderRadius: 10, padding: 3 }}>
      {options.map((o, i) => (
        <div key={o} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: i === on ? C.surface : 'transparent', boxShadow: i === on ? '0 1px 3px rgba(30,41,59,.15)' : undefined, fontFamily: F.body, fontWeight: i === on ? 700 : 400, fontSize: 13.5, color: i === on ? C.ink : C.muted }}>
          {o}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0', background: C.screen }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 12 }}>Settings</div>
      {row('Theme', segmented(['System', 'Light', 'Dark'], 1))}
      {row(
        'Your feed',
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative', height: 6, borderRadius: 3, background: C.card }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(feed / 60) * 100}%`, borderRadius: 3, background: C.accent }} />
            <div style={{ position: 'absolute', left: `calc(${(feed / 60) * 100}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: C.surface, border: `2px solid ${C.accent}`, boxShadow: '0 2px 6px rgba(30,41,59,.2)' }} />
          </div>
          <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 16, color: C.ink, width: 28 }}>{feed}</span>
        </div>,
        'How much reaches you before work waits',
      )}
      {row(
        'Work at once',
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['−', String(runs), '+'].map((t, i) => (
            <div key={i} style={{ width: i === 1 ? 40 : 34, height: 34, borderRadius: 10, background: i === 1 ? 'transparent' : C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: i === 1 ? F.mono : F.body, fontWeight: 700, fontSize: 18, color: C.ink }}>
              {t}
            </div>
          ))}
        </div>,
        'Across all your projects',
      )}
      {row(
        'AI model',
        <>
          {segmented(['One', 'Per task', 'By risk'], risk ? 2 : 0)}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, opacity: risk ? ramp(f, SETTINGS + 112, 10) : 0.25 }}>
            {[
              ['Low risk', 'Haiku'],
              ['Medium risk', 'Sonnet'],
              ['High risk', 'Opus'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', fontFamily: F.body, fontSize: 14, color: C.ink }}>
                <span style={{ flex: 1, color: C.muted }}>{k}</span>
                <span style={{ fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </>,
      )}
    </div>
  );
}

/** What each setting just changed, floating out beside the phone */
function Tuned({ f }: { f: number }) {
  if (f < SETTINGS || f > WALL + 10) return null;
  const out = ramp(f, WALL - 10, 16);
  const chips: [string, string, number, number, number][] = [
    ['25 in your feed', ICONS.feed, 470, 330, SETTINGS + 60],
    ['4 tasks at once', PARTS.terminal, 1450, 470, SETTINGS + 94],
    ['Strongest AI for risky work', PARTS.shield, 470, 690, SETTINGS + 116],
  ];
  return (
    <>
      {chips.map(([text, glyph, x, y, at]) => {
        const t = pop(f, at, true);
        return (
          <div key={text} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${t * (1 - out)})`, display: 'flex', alignItems: 'center', gap: 14, background: C.surface, borderRadius: 999, padding: '14px 28px 14px 18px', boxShadow: '0 20px 40px rgba(30,41,59,.15)', border: `2px solid ${C.accent}` }}>
            <Glyph path={glyph} size={34} color={C.accent} stroke={glyph !== ICONS.feed} />
            <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 32, color: C.ink, whiteSpace: 'nowrap' }}>{text}</span>
          </div>
        );
      })}
    </>
  );
}

// The wall: every kind of screen the app shows
const CARDS: Entity[] = [
  { project: { name: 'bookshelf', color: '#1D6FD6' }, type: 'Product/Goal', title: 'Readers find a book fast', desc: 'A reader finds a book by author or title in one step.', bullets: ['Not met yet: there is no search'], state: 'unverified' },
  { project: { name: 'handbook', color: '#7C3AED' }, type: 'Governance/Policy', title: 'Remote work policy', desc: 'Up to three remote days a week.', bullets: ['Core hours 10:00 to 16:00'], state: 'verified' },
  { project: { name: 'to-do app', color: '#C2410C' }, type: 'Product/Feature', title: 'Due dates', desc: 'Overdue to-dos come first.', bullets: ['todo due <id> 2026-11-01'], state: 'unverified' },
  { project: { name: 'notes', color: '#0F766E' }, type: 'Testing/TestSuite', title: 'Sharing checks', desc: 'Every way a note is shared, tried out.', bullets: ['31 checks, all passing'], state: 'verified' },
];

function MiniPhone({ k }: { k: number }) {
  const kind = k % 4;
  if (kind === 1) {
    return (
      <Phone tab="chat" style={{ position: 'relative' }} screen={
        <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 22, color: C.ink }}>Search by author</div>
          <Bubble mine>Add search by author.</Bubble>
          <Bubble>Done. Ready for your review.</Bubble>
          <Bubble mine>Why not by genre too?</Bubble>
          <Bubble>Genres come next; see the plan.</Bubble>
        </div>
      } />
    );
  }
  return (
    <Phone tab="feed" style={{ position: 'relative' }}>
      <Counters unverified={20 + k} verified={40 + k} />
      <Behind depth={2} />
      <Behind depth={1} />
      <FeedCard e={CARDS[k % CARDS.length]!} />
    </Phone>
  );
}

function MiniWindow({ k }: { k: number }) {
  return (
    <Desktop tab="explorer" url="momentum / explorer" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 40, top: 40, right: 40 }}>
        <DomainBadge type={['Product/Feature', 'Data/Schema', 'Governance/DesignDoc'][k % 3]!} size={64} />
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 52, color: C.ink, margin: '18px 0' }}>{['Book catalogue', 'Book', 'Bookshelf design'][k % 3]}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <StateBadge state="verified" style={{ transform: 'scale(1.6)', transformOrigin: 'left' }} />
        </div>
      </div>
    </Desktop>
  );
}

function Wall({ f, drift }: { f: number; drift: number }) {
  if (f < WALL - 20) return null;
  const shown = ramp(f, WALL - 20, 30, Easing.out(Easing.cubic));
  const recede = ramp(f, LOGO - 10, 40, Easing.inOut(Easing.cubic));
  const pan = mix(drift, 140, -140);
  const tiles = Array.from({ length: 21 }, (_, i) => i);
  return (
    <AbsoluteFill style={{ perspective: 2400, opacity: shown * (1 - 0.82 * recede), filter: `blur(${8 * recede}px)`, maskImage: 'radial-gradient(ellipse 62% 60% at 50% 50%, black 62%, transparent 100%)' }}>
      <div style={{ position: 'absolute', left: 960, top: 540, transformStyle: 'preserve-3d', transform: `translateX(${pan}px) rotateY(-16deg) rotateX(8deg) scale(${mix(shown, 1.6, 0.42) * mix(recede, 1, 0.9)})` }}>
        {tiles.map((i) => {
          const col = i % 7;
          const row = Math.floor(i / 7);
          const window = (col + row) % 3 === 2;
          const lit = pop(f, WALL - 10 + ((col * 3 + row * 5) % 14) * 2);
          return (
            <div key={i} style={{ position: 'absolute', left: (col - 3) * 560 - (window ? 380 : 209), top: (row - 1) * 980 - (window ? 280 : 436), transform: `scale(${window ? 0.62 : 1}) translateZ(${((col * 7 + row * 3) % 5) * 30}px)`, transformOrigin: '0 0', opacity: lit }}>
              {window ? <MiniWindow k={i} /> : <MiniPhone k={i} />}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Closing({ f }: { f: number }) {
  if (f < LOGO) return null;
  const logo = pop(f, LOGO + 6);
  const line = ramp(f, LOGO + 22, 16, Easing.out(Easing.cubic));
  const last = ramp(f, LOGO + 40, 16, Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ opacity: logo, transform: `scale(${mix(logo, 0.85, 1)})` }}>
        <Logo width={720} />
      </div>
      <div style={{ fontFamily: F.head, fontSize: 64, color: C.ink, marginTop: 40, opacity: line, transform: `translateY(${20 * (1 - line)}px)` }}>Your attention, where it pays.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: F.body, fontSize: 32, color: C.muted, marginTop: 22, opacity: last }}>
        <Glyph path={PARTS.shield} size={34} color={C.ok} stroke />
        Open source. On your own machine.
      </div>
    </div>
  );
}

/** The narration: a line per beat */
export const LINE_CUES: Cue[] = [
  { at: 8, hold: WALL - 10, text: 'Decide how much reaches you, and how much runs at once.' },
  { at: WALL + 4, hold: LOGO - 4, text: 'Every project, in one place.' },
  { at: LOGO + 4, hold: LINE_FRAMES - 10, text: 'Momentum. Open source, on your own machine. Your attention, where it pays.' },
];
const DWELLS = voiceDwells('Line', LINE_CUES, LINE_FRAMES);
export const LINE_LENGTH = dwelt(LINE_FRAMES, DWELLS);

export function Line() {
  const f = useSceneFrame(DWELLS);
  const drift = useDrift(WALL - 20, DWELLS, LINE_LENGTH);
  // The phone with its Settings, then gone into the wall
  const away = ramp(f, WALL - 24, 26, Easing.in(Easing.cubic));
  const scale = mix(pop(f, 0), 0.9, 1) * mix(away, 1, 0.3);
  return (
    <AbsoluteFill>
      <Voice scene="Line" cues={LINE_CUES} dwells={DWELLS} />
      <Backdrop />
      <Wall f={f} drift={drift} />
      {away < 1 ? (
        <Phone
          tab={null}
          screen={<SettingsScreen f={f} />}
          style={{ left: 960 - PHONE.w / 2, top: 540 - PHONE.h / 2, opacity: pop(f, 0) * (1 - away), transform: `translateY(56px) perspective(2000px) rotateY(-6deg) scale(${0.8 * scale})` }}
        />
      ) : null}
      <Tuned f={f} />
      {/* Above the phone, never behind it */}
      <TopHeadline frame={f} from={SETTINGS} to={WALL} tag="Settings" color={C.accent} text="Tuned to you." />
      <Closing f={f} />
      {/* The scene's own captions */}
      {f >= SETTINGS && f < WALL ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 60, textAlign: 'center', fontFamily: F.body, fontSize: 30, color: C.muted, opacity: ramp(f, SETTINGS + 10, 12) * (1 - ramp(f, WALL - 12, 12)) }}>
          How much reaches you, how much runs at once: yours to set.
        </div>
      ) : null}
      {f >= WALL && f < LOGO ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center', fontFamily: F.head, fontWeight: 700, fontSize: 56, color: C.ink, opacity: ramp(f, WALL + 6, 12) * (1 - ramp(f, LOGO - 12, 12)), textShadow: `0 0 30px ${C.behind1}` }}>
          Every project. One place.
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

