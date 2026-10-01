import { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export type Scheme = 'light' | 'dark';
/** What the user chose in Settings; `system` follows the device. */
export type Appearance = 'system' | Scheme;

const LIGHT = {
  ink: '#2F3E46',
  muted: '#52606A',
  accent: '#B85042',
  ok: '#3F6B52',
  no: '#A0402F',
  screen: '#F7F5F0',
  line: '#D5D9D3',
  card: '#EEF1EC',
  /** Raised surfaces (lists, cards, the tab bar), and glyphs drawn on a filled colour. */
  surface: '#FFFFFF',
  washNo: '#F4DCD6',
  washWarn: '#EFE8D2',
  warn: '#8A6D2B',
  /** Entity state icons: saturated so a 16px stroke reads at a glance. */
  stateUnverified: '#C98A00',
  stateVerified: '#16924A',
  stateSynced: '#5B6B74',
  stateEntityAhead: '#E0401F',
  stateArtifactAhead: '#1A6FD6',
  stateUpdating: '#7A3FE0',
  washOk: '#DCE7DF',
  behind1: '#FBFAF7',
  behind2: '#F3F1EC',
  commentBg: '#FBF4F2',
  /** Backdrop of diagrams, which are drawn dark on light. */
  diagram: 'transparent',
  /** Solid sheet behind a diagram opened full size over the dimmed screen. */
  diagramSheet: '#FFFFFF',
  dim: 'rgba(30,41,59,.55)',
  /** A second neutral for charts, told apart from `muted`. */
  faint: '#A7B0B5',
};

type Palette = { readonly [K in keyof typeof LIGHT]: string };

const DARK: Palette = {
  ink: '#E4E8E3',
  muted: '#9AA7AE',
  accent: '#E07A66',
  ok: '#7DB594',
  no: '#E8806B',
  screen: '#161C1F',
  line: '#364247',
  card: '#263035',
  surface: '#1E262A',
  washNo: '#4A2B25',
  washWarn: '#3F3722',
  warn: '#D3B26B',
  stateUnverified: '#FFC233',
  stateVerified: '#3DDC84',
  stateSynced: '#C2CDD3',
  stateEntityAhead: '#FF6B4A',
  stateArtifactAhead: '#4DA8FF',
  stateUpdating: '#B07CFF',
  washOk: '#223A2D',
  behind1: '#1B2226',
  behind2: '#192024',
  commentBg: '#2F2523',
  diagram: '#EEF1EC',
  diagramSheet: '#EEF1EC',
  dim: 'rgba(0,0,0,.6)',
  faint: '#5E6B72',
};

export const PALETTES: Record<Scheme, Palette> = { light: LIGHT, dark: DARK };

let current: Palette = LIGHT;

/**
 * The colours of the scheme in effect. Read them while rendering, never into module-level constants: every route
 * calls `useTheme()` so the whole tree renders again with the other palette when the scheme changes.
 */
export const C: Palette = Object.defineProperties(
  {},
  Object.fromEntries(Object.keys(LIGHT).map((k) => [k, { enumerable: true, get: () => current[k as keyof Palette] }])),
) as Palette;

/** Makes `C` return the colours of `scheme`; called by the appearance provider before its subtree renders. */
export function applyScheme(scheme: Scheme): void {
  current = PALETTES[scheme];
}

export type Theme = { scheme: Scheme; appearance: Appearance; setAppearance: (a: Appearance) => void };

export const ThemeContext = createContext<Theme>({ scheme: 'light', appearance: 'system', setAppearance: () => {} });

/** Subscribes a route to the theme; call it at the top of every screen and layout. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export const F = {
  head: Platform.select({ web: 'Cambria, Georgia, "Times New Roman", serif', default: 'serif' }),
  body: Platform.select({ web: 'Calibri, "Segoe UI", Helvetica, Arial, sans-serif', default: undefined }),
  mono: Platform.select({ web: 'Consolas, monospace', default: 'monospace' }),
};

/** Width at which the web layout (left rail, split panes) applies, as in pages.html. */
export const WIDE = 700;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE;
}
