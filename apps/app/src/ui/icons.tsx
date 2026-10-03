import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from './theme';

/** Glyph paths from docs/designs/pages.html. */
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
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z',
} as const;

export function Icon({ name, size, color }: { name: keyof typeof PATHS; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PATHS[name]} fill={color} />
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
