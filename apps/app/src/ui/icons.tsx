import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from './theme';

/** Glyph paths. */
export const PATHS = {
  feed: 'M12 3 2 8l10 5 10-5-10-5zm-7.6 8.4L2 12.6l10 5 10-5-2.4-1.2L12 15.2zm0 4.2L2 16.8l10 5 10-5-2.4-1.2L12 19.4z',
  explorer: 'M5 3h5v5H5zm9 0h5v5h-5zM9.5 16h5v5h-5zM7.5 8v3h9V8h-1.5v1.5h-6V8zM11.25 11h1.5v5h-1.5z',
  chat: 'M3 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm16 4h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-6a2 2 0 0 1-2-2v-1h7a4 4 0 0 0 4-4z',
  metrics: 'M3 3h2v16h16v2H3zm4 12 4-5 3 3 6-8 1.5 1.2-7.5 10-3-3-2.5 3z',
  settings:
    'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3H9l-.3 2.9a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.7 7.7 0 0 0 1.7 1L9 21h6l.3-2.9a7.7 7.7 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z',
  lock: 'M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z',
  search: 'M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  agent:
    'M12 2a5 5 0 0 1 5 5v1h1a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-1.2l-2.3 3-1.6-1.2 1.4-1.8H9.7l1.4 1.8-1.6 1.2-2.3-3H6a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v1h6V7a3 3 0 0 0-3-3zM9 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  send: 'M3 11 21 3l-8 18-2-8z',
  timeline:
    'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5.25l4.5 2.67.77-1.28-3.77-2.24V8z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v5.6l4.4 2.6.8-1.3-3.7-2.2V7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  commit: 'M2 11h5.1a5 5 0 0 1 9.8 0H22v2h-5.1a5 5 0 0 1-9.8 0H2zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  power:
    'M13 3h-2v10h2zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 1 1-11.42-5.42L6.17 5.17A8.93 8.93 0 0 0 3 12a9 9 0 0 0 18 0c0-2.74-1.23-5.18-3.17-6.83z',
  refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z',
} as const;

/** Glyphs whose inner shape is a hole */
const HOLLOW = new Set<keyof typeof PATHS>(['clock', 'commit']);

export function Icon({ name, size, color }: { name: keyof typeof PATHS; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PATHS[name]} fill={color} fillRule={HOLLOW.has(name) ? 'evenodd' : undefined} />
    </Svg>
  );
}

/** Row chevron: 8px square, 1.5px muted border, rotated to point right (or down when open). */
export function Chevron({ open, style }: { open?: boolean; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          width: 8,
          height: 8,
          borderRightWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: C.muted,
          transform: [{ rotate: open ? '45deg' : '-45deg' }],
          flexShrink: 0,
          marginRight: 2,
        },
        style,
      ]}
    />
  );
}

/** Tree triangle: points down when open, right when closed. */
export function Triangle({ open }: { open: boolean }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: C.muted,
        transform: [{ rotate: open ? '0deg' : '-90deg' }],
        flexShrink: 0,
      }}
    />
  );
}
