// Scene 9, after the deck's "Git" and "Settings", and the close. The camera flies low along the main line, a road with
// a commit at every post and no turn-off, the phone floating ahead with its timeline. The phone comes close and its
// Settings tune the harness, over giant words. The camera pulls back on a wall of every screen of the app, and the
// logo.
import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Behind, Bubble, Counters, FeedCard, Glyph, PHONE, Phone, type Entity } from '../kit/app.tsx';
import { Desktop, DomainBadge, StateBadge } from '../kit/desktop.tsx';
import { Backdrop, Logo } from '../kit/stage.tsx';
import { C, F, ICONS, PARTS } from '../kit/theme.ts';
import { dwell, dwelt, mix, pop, ramp } from '../kit/motion.ts';
import { type Cue, Voice, voiceDwells } from '../kit/voice.tsx';

export const LINE_FRAMES = 510;

// Beats
const SETTINGS = 168;
const WALL = 326;
const LOGO = 420;

const COMMITS: [string, string][] = [
  ['Implementation', C.ok],
  ['Approval', C.no],
  ['Summarization', C.warn],
  ['Your commit', C.accent],
  ['Validation', C.ok],
  ['Consistency check', C.warn],
  ['Approval', C.no],
  ['Preparation', C.ok],
  ['Retention', C.muted],
  ['Implementation', C.ok],
  ['Approval', C.no],
  ['Graph build', C.warn],
  ['Summarization', C.warn],
  ['Approval', C.no],
];

// The road: a long plane tilted away from the camera, flown along
const ROAD = { w: 2600, len: 9000, tilt: 74 };
const POST = 560;
const SPEED = 21;

/** Something standing up from the road, facing the camera */
function Post({ y, opacity, children }: { y: number; opacity: number; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: ROAD.w / 2 - 70, top: y, transformStyle: 'preserve-3d', transform: `rotateX(${-ROAD.tilt}deg)`, opacity }}>
      <div style={{ position: 'absolute', right: 0, bottom: 0 }}>{children}</div>
    </div>
  );
}

function Road({ f }: { f: number }) {
  const shown = ramp(f, 0, 16);
  const gone = ramp(f, SETTINGS - 10, 30);
  if (gone >= 1) return null;
  const travel = f * SPEED;
  return (
    <AbsoluteFill style={{ perspective: 900, perspectiveOrigin: '960px 360px', opacity: shown * (1 - gone) }}>
      <div style={{ position: 'absolute', left: 960 - ROAD.w / 2, top: 1250 - ROAD.len, width: ROAD.w, height: ROAD.len, transformOrigin: '50% 100%', transformStyle: 'preserve-3d', transform: `rotateX(${ROAD.tilt}deg)` }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateY(${travel % 200}px)` }}>
          {/* The ground, ruled across so the motion reads */}
          <div style={{ position: 'absolute', inset: '-200px 0 0', background: `repeating-linear-gradient(0deg, ${C.behind2} 0px, ${C.behind2} 100px, ${C.behind1} 100px, ${C.behind1} 200px)` }} />
        </div>
        {/* The main line itself, the one road */}
        <div style={{ position: 'absolute', left: ROAD.w / 2 - 22, top: 0, bottom: 0, width: 44, background: C.ink, borderRadius: 22 }} />
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateY(${travel}px)` }}>
          {/* Words painted on the road, read as they pass under the camera */}
          {[
            // Painted right of the line, the posts standing left of it: neither covers the other
            ['ONE STRAIGHT LINE', 1180],
            ['NO BRANCHES', 2300],
            ['NO MERGES', 3420],
          ].map(([text, d]) => (
            // Gone before it reaches the bottom of the frame, like the posts
            <div key={text} style={{ position: 'absolute', left: ROAD.w / 2 + 90, top: ROAD.len - (d as number), fontFamily: F.head, fontWeight: 700, fontSize: 120, color: C.accent, opacity: 0.85 * Math.min(1, Math.max(0, ((d as number) - travel - 300) / 500)), letterSpacing: 4, whiteSpace: 'nowrap' }}>
              {text}
            </div>
          ))}
          {COMMITS.map(([label, color], i) => {
            // Gone before it comes too close to the camera
            const ahead = 900 + i * POST - travel;
            return (
              <Post key={i} y={ROAD.len - 900 - i * POST} opacity={Math.min(1, Math.max(0, (ahead - 250) / 450))}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 56, color: C.ink, background: 'rgba(255,255,255,.92)', borderRadius: 14, padding: '6px 20px', whiteSpace: 'nowrap' }}>{label}</span>
                  <div style={{ width: 76, height: 76, borderRadius: 38, background: C.surface, border: `12px solid ${color}`, boxSizing: 'border-box', boxShadow: `0 0 30px ${color}88` }} />
                </div>
              </Post>
            );
          })}
        </div>
      </div>
      {/* The horizon, hazed */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420, background: `linear-gradient(${C.behind1} 55%, transparent)` }} />
    </AbsoluteFill>
  );
}

/** The phone's timeline: a commit for each post passed */
function Commits({ f }: { f: number }) {
  const passed = Math.min(COMMITS.length, Math.max(0, Math.floor((f * SPEED - 300) / POST)) + 3);
  const list = COMMITS.slice(0, passed).reverse().slice(0, 9);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0' }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 12 }}>Timeline</div>
      {list.map(([label, color], i) => (
        <div key={passed - i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Glyph path={ICONS.commit} size={20} color={color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: C.ink }}>{label}</div>
            <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted }}>one commit on main</div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
        'Feed size',
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative', height: 6, borderRadius: 3, background: C.card }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(feed / 60) * 100}%`, borderRadius: 3, background: C.accent }} />
            <div style={{ position: 'absolute', left: `calc(${(feed / 60) * 100}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: C.surface, border: `2px solid ${C.accent}`, boxShadow: '0 2px 6px rgba(30,41,59,.2)' }} />
          </div>
          <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 16, color: C.ink, width: 28 }}>{feed}</span>
        </div>,
        'Items before the loops pause',
      )}
      {row(
        'Concurrent runs',
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['−', String(runs), '+'].map((t, i) => (
            <div key={i} style={{ width: i === 1 ? 40 : 34, height: 34, borderRadius: 10, background: i === 1 ? 'transparent' : C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: i === 1 ? F.mono : F.body, fontWeight: 700, fontSize: 18, color: C.ink }}>
              {t}
            </div>
          ))}
        </div>,
        'In total, across projects',
      )}
      {row(
        'Models',
        <>
          {segmented(['One', 'Per automation', 'By risk'], risk ? 2 : 0)}
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
    ['Feed size 25', ICONS.feed, 470, 330, SETTINGS + 60],
    ['4 runs at once', PARTS.terminal, 1450, 470, SETTINGS + 94],
    ['Opus for high risk', PARTS.shield, 470, 690, SETTINGS + 116],
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

/** Giant words behind the phone */
function Giant({ f, from, to, text }: { f: number; from: number; to: number; text: string }) {
  if (f < from || f > to) return null;
  const t = ramp(f, from, 18, Easing.out(Easing.cubic)) * (1 - ramp(f, to - 12, 12));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontFamily: F.head, fontWeight: 700, fontSize: 260, letterSpacing: -4, color: 'rgba(47,62,70,.13)', opacity: t, transform: `scale(${mix(t, 1.15, 1)})`, whiteSpace: 'nowrap' }}>
      {text}
    </div>
  );
}

// The wall: every kind of screen the app shows
const CARDS: Entity[] = [
  { project: { name: 'bookshelf-api', color: '#1D6FD6' }, type: 'Product/Goal', title: 'Readers find a book fast', desc: 'A reader finds a book by author or by title in one request.', bullets: ['Not met yet: the API has no search'], state: 'unverified' },
  { project: { name: 'handbook', color: '#7C3AED' }, type: 'Governance/Policy', title: 'Remote work policy', desc: 'Up to three remote days a week.', bullets: ['Core hours 10:00 to 16:00'], state: 'verified' },
  { project: { name: 'todo-cli', color: '#C2410C' }, type: 'Product/Feature', title: 'Due dates', desc: 'Overdue to-dos come first.', bullets: ['todo due <id> 2026-11-01'], state: 'unverified' },
  { project: { name: 'notes-api', color: '#0F766E' }, type: 'Testing/TestSuite', title: 'Notes API tests', desc: 'Every route, valid and invalid input.', bullets: ['31 tests, all passing'], state: 'verified' },
];

function MiniPhone({ k }: { k: number }) {
  const kind = k % 4;
  if (kind === 1) {
    return (
      <Phone tab="chat" style={{ position: 'relative' }} screen={
        <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 22, color: C.ink }}>Search by author</div>
          <Bubble mine>Add search by author.</Bubble>
          <Bubble>Implemented, with 9 tests. Committed to main.</Bubble>
          <Bubble mine>Why not full text?</Bubble>
          <Bubble>One request is enough for now; see the design.</Bubble>
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
        <DomainBadge type={['Architecture/Api', 'Data/Schema', 'Governance/DesignDoc'][k % 3]!} size={64} />
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 52, color: C.ink, margin: '18px 0' }}>{['Books API', 'Book', 'Bookshelf API design'][k % 3]}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <StateBadge state="verified" style={{ transform: 'scale(1.6)', transformOrigin: 'left' }} />
        </div>
      </div>
    </Desktop>
  );
}

function Wall({ f }: { f: number }) {
  if (f < WALL - 20) return null;
  const shown = ramp(f, WALL - 20, 30, Easing.out(Easing.cubic));
  const recede = ramp(f, LOGO - 10, 40, Easing.inOut(Easing.cubic));
  const pan = interpolate(f, [WALL - 20, LINE_FRAMES], [140, -140]);
  const tiles = Array.from({ length: 21 }, (_, i) => i);
  return (
    <AbsoluteFill style={{ perspective: 2400, opacity: shown * (1 - 0.82 * recede), filter: `blur(${8 * recede}px)` }}>
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
        Self-hosted. On your machine, over your own mesh.
      </div>
    </div>
  );
}

/** The narration: a line per beat */
export const LINE_CUES: Cue[] = [
  { at: 8, hold: 160, text: 'Every run and every approval is one commit, on one straight line.' },
  { at: 172, hold: 318, text: 'Feed size, concurrent runs, models by risk: tuned to how you work.' },
  { at: 330, hold: 410, text: 'Every project, in one place.' },
  { at: 424, hold: 500, text: 'Momentum. Self-hosted, open source. Your attention, where it pays.' },
];
const DWELLS = voiceDwells('Line', LINE_CUES, LINE_FRAMES);
export const LINE_LENGTH = dwelt(LINE_FRAMES, DWELLS);

export function Line() {
  const f = dwell(useCurrentFrame(), DWELLS);
  // The phone: floating ahead over the road, then close for Settings, then gone into the wall
  const close = ramp(f, SETTINGS - 16, 30, Easing.inOut(Easing.cubic));
  const away = ramp(f, WALL - 24, 26, Easing.in(Easing.cubic));
  const settings = f >= SETTINGS;
  const y = mix(close, 330, 540) + 10 * Math.sin(f / 14) * (1 - close);
  const x = mix(close, 1500, 960);
  const scale = mix(close, 0.62, 1) * mix(away, 1, 0.3);
  return (
    <AbsoluteFill>
      <Voice scene="Line" cues={LINE_CUES} dwells={DWELLS} />
      <Backdrop />
      <Road f={f} />
      <Giant f={f} from={SETTINGS} to={WALL} text="Tuned to you." />
      <Wall f={f} />
      {away < 1 ? (
        <Phone
          tab={settings ? null : 'timeline'}
          screen={settings ? <SettingsScreen f={f} /> : <Commits f={f} />}
          style={{ left: x - PHONE.w / 2, top: y - PHONE.h / 2, opacity: pop(f, 0) * (1 - away), transform: `perspective(2000px) rotateX(${12 * (1 - close)}deg) rotateY(${-6 * close - 14 * (1 - close)}deg) scale(${scale})` }}
        />
      ) : null}
      <Tuned f={f} />
      <Closing f={f} />
      {/* The scene's own captions */}
      {f >= SETTINGS && f < WALL ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 60, textAlign: 'center', fontFamily: F.body, fontSize: 30, color: C.muted, opacity: ramp(f, SETTINGS + 10, 12) * (1 - ramp(f, WALL - 12, 12)) }}>
          Feed size, concurrent runs, models by risk: yours to set.
        </div>
      ) : null}
      {f < SETTINGS ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center', opacity: ramp(f, 10, 12) * (1 - ramp(f, SETTINGS - 14, 12)) }}>
          <div style={{ fontFamily: F.body, fontSize: 32, color: C.ink, background: C.surface, borderRadius: 999, padding: '12px 32px', boxShadow: '0 12px 30px rgba(30,41,59,.15)' }}>
            Every run, every approval: one commit on <span style={{ fontFamily: F.mono, fontWeight: 700 }}>main</span>.
          </div>
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

