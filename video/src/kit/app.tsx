// The app's pieces as the phone shows them, drawn after apps/app/src/app/(tabs)/feed.tsx and apps/app/src/ui
import type { CSSProperties, ReactNode } from 'react';
import { C, F, ICONS, STATES, domainOf, type State } from './theme.ts';

export const SCREEN = { w: 390, h: 844 };
const BEZEL = 14;
export const PHONE = { w: SCREEN.w + 2 * BEZEL, h: SCREEN.h + 2 * BEZEL };
/** Where the feed's card sits on the screen */
export const SLOT = { x: 16, y: 104, w: SCREEN.w - 32, h: 590 };

export function Glyph({ path, size, color, stroke }: { path: string; size: number; color: string; stroke?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }}>
      {stroke ? (
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={path} fill={color} />
      )}
    </svg>
  );
}

export function StateIcon({ state, size = 16 }: { state: State; size?: number }) {
  const s = STATES[state];
  return <Glyph path={s.path} size={size} color={s.color} stroke />;
}

/** An entity type as cards show it: its glyph and segments in a pill tinted with its main type's colour */
export function TypePill({ type, size = 13 }: { type: string; size?: number }) {
  const d = domainOf(type);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: d.color + '29', borderRadius: 999, padding: '3px 10px 3px 8px' }}>
      <Glyph path={d.path} size={size + 2} color={d.color} stroke />
      <span style={{ fontFamily: F.body, fontSize: size, color: d.color }}>{type.split('/').join(' · ')}</span>
    </div>
  );
}

export interface Project {
  name: string;
  color: string;
}

export function ProjectMark({ project, size = 18 }: { project: Project; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: project.color,
        color: '#fff',
        fontFamily: F.body,
        fontWeight: 700,
        fontSize: size * 0.6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {project.name[0]?.toUpperCase()}
    </div>
  );
}

export interface Entity {
  project: Project;
  type: string;
  title: string;
  desc: string;
  bullets: string[];
  state: State;
}

/** The feed's top card */
export function FeedCard({ e, style, spin = 0, children }: { e: Entity; style?: CSSProperties; spin?: number; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: SLOT.x,
        top: SLOT.y,
        width: SLOT.w,
        height: SLOT.h,
        boxSizing: 'border-box',
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        padding: '20px 20px 16px',
        boxShadow: '0 10px 30px rgba(30,41,59,.10)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TypePill type={e.type} />
        <div style={{ flex: 1 }} />
        <div style={{ transform: `rotate(${spin}deg)` }}>
          <StateIcon state={e.state} size={18} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <ProjectMark project={e.project} />
        <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.muted }}>{e.project.name}</span>
      </div>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 25, lineHeight: 1.2, color: C.ink, marginBottom: 12 }}>{e.title}</div>
      <div style={{ fontFamily: F.body, fontSize: 15, lineHeight: '21px', color: C.muted, marginBottom: 12 }}>{e.desc}</div>
      {e.bullets.map((b) => (
        <div key={b} style={{ display: 'flex', gap: 8, fontFamily: F.body, fontSize: 14.5, lineHeight: '21px', color: C.ink, marginBottom: 6 }}>
          <span>•</span>
          <span>{b}</span>
        </div>
      ))}
      {children}
    </div>
  );
}

/** The cards waiting behind the top one, each edge showing above the card in front */
export function Behind({ depth, style }: { depth: 1 | 2; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: SLOT.x,
        top: SLOT.y,
        width: SLOT.w,
        height: SLOT.h,
        boxSizing: 'border-box',
        background: depth === 1 ? C.behind1 : C.behind2,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        transformOrigin: 'top',
        transform: depth === 1 ? 'translateY(-8px) scale(0.965)' : 'translateY(-16px) scale(0.93)',
        ...style,
      }}
    />
  );
}

export function Stamp({ kind, label, style }: { kind: 'ok' | 'no'; label: string; style?: CSSProperties }) {
  const color = kind === 'ok' ? C.ok : C.no;
  return (
    <div
      style={{
        position: 'absolute',
        border: `3px solid ${color}`,
        borderRadius: 6,
        background: C.surface,
        padding: '8px 16px',
        color,
        fontFamily: F.body,
        fontWeight: 700,
        letterSpacing: 3,
        fontSize: 17,
        transform: `rotate(${kind === 'ok' ? -6 : 6}deg)`,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

/** Entities of the enabled projects by verification, above the feed */
export function Counters({ unverified, verified, bump = 0 }: { unverified: number; verified: number; bump?: number }) {
  const item = (state: State, n: number, scale = 1) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, transform: `scale(${scale})` }}>
      <StateIcon state={state} />
      <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.ink }}>{n}</span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: 16, top: 56, display: 'flex', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, background: C.card, borderRadius: 999, padding: '4px 12px' }}>
        {item('unverified', unverified)}
        {item('verified', verified, 1 + bump * 0.35)}
      </div>
    </div>
  );
}

export const TABS = [
  ['feed', 'Feed'],
  ['explorer', 'Explorer'],
  ['chat', 'Sessions'],
  ['timeline', 'Timeline'],
  ['metrics', 'Metrics'],
] as const;

export type Tab = (typeof TABS)[number][0];

function TabBar({ active }: { active: Tab | null }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 82,
        background: C.surface,
        borderTop: `1px solid ${C.line}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingTop: 10,
        boxSizing: 'border-box',
      }}
    >
      {TABS.map(([name, label]) => {
        const color = name === active ? C.accent : C.muted;
        return (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Glyph path={ICONS[name]} size={24} color={color} />
            <span style={{ fontFamily: F.body, fontSize: 11, color }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The phone with the app on one of its tabs: the screen's own layers under whatever the scene puts on it */
export function Phone({ children, style, tab = 'feed', screen }: { children?: ReactNode; style?: CSSProperties; tab?: Tab | null; screen?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: PHONE.w,
        height: PHONE.h,
        borderRadius: 58,
        background: C.ink,
        boxShadow: '0 40px 80px rgba(30,41,59,.25), 0 8px 20px rgba(30,41,59,.15)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SCREEN.w, height: SCREEN.h, borderRadius: 44, background: C.screen, overflow: 'hidden' }}>
        {screen}
        <div style={{ position: 'absolute', left: SCREEN.w / 2 - 60, top: 12, width: 120, height: 32, borderRadius: 16, background: C.ink }} />
        <div style={{ position: 'absolute', right: 18, top: 54, opacity: 0.9 }}>
          <Glyph path={ICONS.settings} size={22} color={C.muted} />
        </div>
        <TabBar active={tab} />
      </div>
      {/* Cards live outside the screen's clip, so they can fly in and away */}
      <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SCREEN.w, height: SCREEN.h }}>{children}</div>
    </div>
  );
}

/** A chat message: the user's on the right in ink, the harness's on the left on a card */
export function Bubble({ mine, children, style }: { mine?: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        background: mine ? C.ink : C.surface,
        color: mine ? '#fff' : C.ink,
        border: mine ? 'none' : `1px solid ${C.line}`,
        borderRadius: 16,
        padding: '9px 13px',
        fontFamily: F.body,
        fontSize: 14.5,
        lineHeight: '20px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A sheet risen from the bottom of the screen, over the dimmed feed */
export function Sheet({ rise, children }: { rise: number; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 44, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,41,59,.55)', opacity: rise }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: C.surface,
          borderRadius: '22px 22px 0 0',
          padding: '12px 20px 34px',
          transform: `translateY(${(1 - rise) * 105}%)`,
        }}
      >
        <div style={{ width: 40, height: 5, borderRadius: 3, background: C.line, margin: '0 auto 16px' }} />
        {children}
      </div>
    </div>
  );
}

export function Button({ label, kind, pressed = 0 }: { label: string; kind: 'ghost' | 'no' | 'ok'; pressed?: number }) {
  const fill = kind === 'ghost' ? C.surface : kind === 'no' ? C.no : C.ok;
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '12px 0',
        borderRadius: 12,
        background: fill,
        border: kind === 'ghost' ? `1px solid ${C.line}` : 'none',
        color: kind === 'ghost' ? C.ink : '#fff',
        fontFamily: F.body,
        fontWeight: 700,
        fontSize: 16,
        transform: `scale(${1 - 0.06 * pressed})`,
      }}
    >
      {label}
    </div>
  );
}
