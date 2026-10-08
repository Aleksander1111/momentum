// The app on a wide screen, in a browser window: the side bar of tabs and the page beside it
import type { CSSProperties, ReactNode } from 'react';
import { Glyph, TABS, type Tab } from './app.tsx';
import { C, F, ICONS, domainOf, STATES, type State } from './theme.ts';

export const WINDOW = { w: 1280, h: 800, bar: 44, nav: 92 };

const WIDE_TABS = [...TABS, ['settings', 'Settings']] as const;

export function Desktop({ tab, url, children, style }: { tab: Tab | 'settings'; url: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: WINDOW.w,
        height: WINDOW.h,
        borderRadius: 16,
        background: C.screen,
        overflow: 'hidden',
        boxShadow: '0 50px 100px rgba(30,41,59,.25), 0 10px 30px rgba(30,41,59,.15)',
        border: `1px solid ${C.line}`,
        ...style,
      }}
    >
      <div style={{ height: WINDOW.bar, background: '#ECEAE4', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: `1px solid ${C.line}` }}>
        {['#E0675B', '#E4B44C', '#62B35F'].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ marginLeft: 24, flex: 1, maxWidth: 520, height: 28, borderRadius: 8, background: C.surface, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, fontFamily: F.body, fontSize: 14, color: C.muted }}>
          <Glyph path="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z" size={13} color={C.muted} />
          {url}
        </div>
      </div>
      <div style={{ position: 'absolute', top: WINDOW.bar, left: 0, bottom: 0, width: WINDOW.nav, background: C.surface, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, paddingTop: 28 }}>
        {WIDE_TABS.map(([name, label]) => {
          const color = name === tab ? C.accent : C.muted;
          return (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Glyph path={ICONS[name]} size={26} color={color} />
              <span style={{ fontFamily: F.body, fontSize: 11, color }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', top: WINDOW.bar, left: WINDOW.nav, right: 0, bottom: 0 }}>{children}</div>
    </div>
  );
}

/** A main type's glyph on a disc tinted with its colour */
export function DomainBadge({ type, size = 28 }: { type: string; size?: number }) {
  const d = domainOf(type);
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: d.color + '29', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Glyph path={d.path} size={Math.round(size * 0.58)} color={d.color} stroke />
    </div>
  );
}

const STATE_LABEL: Record<State, string> = { unverified: 'Unverified', verified: 'Verified', updating: 'Updating' };

/** An entity's state as a labelled badge */
export function StateBadge({ state, spin = 0, style }: { state: State | 'synced'; spin?: number; style?: CSSProperties }) {
  const synced = state === 'synced';
  const color = synced ? '#5B6B74' : STATES[state].color;
  const path = synced ? 'M9 15l6-6M11 6l.46-.54a5 5 0 0 1 7.08 7.08l-.54.46M13 18l-.4.53a5.07 5.07 0 0 1-7.12 0 4.97 4.97 0 0 1 0-7.07l.52-.46' : STATES[state].path;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color + '1F', borderRadius: 999, padding: '4px 12px 4px 8px', ...style }}>
      <div style={{ transform: `rotate(${spin}deg)`, display: 'flex' }}>
        <Glyph path={path} size={16} color={color} stroke />
      </div>
      <span style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: 700, color }}>{synced ? 'Synced' : STATE_LABEL[state]}</span>
    </div>
  );
}

/** The mouse pointer, and a ring where it clicks */
export function Pointer({ x, y, opacity, click }: { x: number; y: number; opacity: number; click: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none', zIndex: 500 }}>
      <div
        style={{
          position: 'absolute',
          left: -22,
          top: -22,
          width: 44,
          height: 44,
          borderRadius: 22,
          border: `3px solid ${C.accent}`,
          opacity: click > 0 ? 1 - click : 0,
          transform: `scale(${0.3 + click})`,
        }}
      />
      <svg width={30} height={40} viewBox="0 0 24 32" style={{ position: 'absolute', left: -3, top: -2, filter: 'drop-shadow(0 4px 6px rgba(30,41,59,.35))' }}>
        <path d="M2 2v24l6.5-6 4 9 4-1.8-4-8.7H21z" fill={C.ink} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
