import { Platform, useWindowDimensions } from 'react-native';

export const C = {
  ink: '#2F3E46',
  muted: '#52606A',
  accent: '#B85042',
  ok: '#3F6B52',
  no: '#A0402F',
  screen: '#F7F5F0',
  line: '#D5D9D3',
  card: '#EEF1EC',
  white: '#FFFFFF',
  washNo: '#F4DCD6',
  washWarn: '#EFE8D2',
  warn: '#8A6D2B',
  washOk: '#DCE7DF',
  behind1: '#FBFAF7',
  behind2: '#F3F1EC',
  commentBg: '#FBF4F2',
  dim: 'rgba(30,41,59,.55)',
} as const;

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
