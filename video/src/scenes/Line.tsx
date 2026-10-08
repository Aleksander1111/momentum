// Scene 9, after the deck's "Git" and "Settings", and the close: every run lands on one straight main line; the
// phone's Settings tune the harness to you; the logo.
import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Glyph, PHONE, Phone } from '../kit/app.tsx';
import { Backdrop, Headline, Logo } from '../kit/stage.tsx';
import { C, F, ICONS, PARTS } from '../kit/theme.ts';
import { mix, pop, ramp } from '../kit/motion.ts';

export const LINE_FRAMES = 480;

const PHONE_AT = { x: 1240, y: 470, scale: 0.8 };
const LINE_Y = 935;
const SETTINGS = 170;
const CLOSE = 352;

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
];
const GAP = 230;

/** The main line across the frame: commits arriving from the right, one after another, never a branch */
function MainLine({ f }: { f: number }) {
  const shift = f * 3.2;
  const draw = ramp(f, 0, 24, Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: LINE_Y - 4, width: 1920 * draw, height: 8, borderRadius: 4, background: C.ink }} />
      {COMMITS.map(([label, color], i) => {
        const x = 700 + i * GAP - shift;
        if (x < -200 || x > 2100) return null;
        const near = Math.max(0, 1 - Math.abs(x - 1240) / 700);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: LINE_Y, transform: 'translate(-50%, -50%)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 17, background: C.surface, border: `7px solid ${color}`, boxSizing: 'border-box', boxShadow: `0 0 ${18 * near}px ${color}` }} />
            <div
              style={{
                position: 'absolute',
                left: 17,
                bottom: 44,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontFamily: F.body,
                fontWeight: 700,
                fontSize: 20,
                color,
                opacity: 0.35 + 0.65 * near,
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 40, top: LINE_Y + 26, fontFamily: F.mono, fontSize: 20, color: C.muted, opacity: draw }}>main</div>
    </div>
  );
}

/** The phone's Settings, tuned live: the feed's size, concurrent runs, models by risk */
function SettingsScreen({ f }: { f: number }) {
  const shown = ramp(f, SETTINGS, 12);
  const feed = Math.round(mix(ramp(f, SETTINGS + 30, 40), 40, 25));
  const runs = f >= SETTINGS + 90 ? 4 : f >= SETTINGS + 78 ? 6 : 8;
  const risk = f >= SETTINGS + 110;
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
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0', background: C.screen, opacity: shown }}>
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
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, opacity: risk ? ramp(f, SETTINGS + 110, 10) : 0.25 }}>
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

/** The phone's timeline of commits, before Settings */
function Commits({ f }: { f: number }) {
  const shown = 1 - ramp(f, SETTINGS, 12);
  const visible = Math.min(COMMITS.length, Math.floor(f / 18) + 4);
  const list = COMMITS.slice(0, visible).reverse().slice(0, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 16px 0', opacity: shown }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, color: C.ink, marginBottom: 12 }}>Timeline</div>
      {list.map(([label, color], i) => (
        <div key={visible - i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px', marginBottom: 8, opacity: i === 0 ? ramp(f, (visible - 4) * 18, 8) : 1 }}>
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

function Closing({ f }: { f: number }) {
  if (f < CLOSE) return null;
  const logo = pop(f, CLOSE + 6);
  const line = ramp(f, CLOSE + 20, 14, Easing.out(Easing.cubic));
  const last = ramp(f, CLOSE + 40, 14, Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: 120, top: 360 }}>
      <div style={{ opacity: logo, transform: `translateY(${30 * (1 - logo)}px)` }}>
        <Logo width={600} />
      </div>
      <div style={{ fontFamily: F.head, fontSize: 56, color: C.ink, marginTop: 40, opacity: line, transform: `translateY(${20 * (1 - line)}px)` }}>Your attention, where it pays.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: F.body, fontSize: 30, color: C.muted, marginTop: 22, opacity: last, transform: `translateY(${20 * (1 - last)}px)` }}>
        <Glyph path={PARTS.shield} size={32} color={C.ok} stroke />
        Self-hosted. On your machine, over your own mesh.
      </div>
    </div>
  );
}

export function Line() {
  const f = useCurrentFrame();
  const enter = pop(f, 0);
  const settings = f >= SETTINGS;
  const outro = ramp(f, CLOSE, 40, Easing.inOut(Easing.cubic));
  return (
    <AbsoluteFill>
      <Backdrop />
      <MainLine f={f} />
      <Phone
        tab={settings ? null : 'timeline'}
        screen={settings ? <SettingsScreen f={f} /> : <Commits f={f} />}
        style={{
          left: PHONE_AT.x - PHONE.w / 2 + 160 * outro,
          top: PHONE_AT.y - PHONE.h / 2,
          opacity: enter,
          transform: `translateY(${40 * (1 - enter)}px) perspective(2000px) rotateY(${mix(outro, -8, -22)}deg) scale(${PHONE_AT.scale * mix(outro, 1, 0.92)})`,
        }}
      />
      <Headline frame={f} from={2} to={SETTINGS - 4} tag="Git" color={C.ink} text="One straight line." sub="A commit per run. No branches, no merges." />
      <Headline frame={f} from={SETTINGS} to={CLOSE - 4} tag="Settings" color={C.accent} text="Tuned to how you work." sub="Feed size, concurrent runs, models by risk." />
      <Closing f={f} />
    </AbsoluteFill>
  );
}
