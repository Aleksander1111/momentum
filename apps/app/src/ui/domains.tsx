import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type Scheme } from './theme';

/**
 * The main entity types (the first segment of a type path, as in docs/entity-types.tsv): a stroked glyph on a 24 grid
 * and a colour per scheme, dark enough to read on white and light enough to read on the dark surface.
 */
const DOMAINS: Record<string, { path: string; light: string; dark: string }> = {
  Product: { path: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5', light: '#C2410C', dark: '#F2994A' },
  Governance: {
    path: 'M7 20h10M6 6l6-1 6 1M12 3v17M9 12L6 6l-3 6a3 3 0 0 0 6 0M21 12l-3-6-3 6a3 3 0 0 0 6 0',
    light: '#7C3AED',
    dark: '#B07CFF',
  },
  Architecture: {
    path: 'M6 7h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2v-4a4 4 0 0 0-8 0v4H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
    light: '#1D6FD6',
    dark: '#4DA8FF',
  },
  Code: { path: 'M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16', light: '#15803D', dark: '#3DDC84' },
  Data: {
    path: 'M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0M4 6v6a8 3 0 0 0 16 0V6M4 12v6a8 3 0 0 0 16 0v-6',
    light: '#0F766E',
    dark: '#2EC4B6',
  },
  Frontend: {
    path: 'M6 4h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    light: '#C0266D',
    dark: '#FF6FAE',
  },
  Testing: {
    path: 'M9 3h6M10 9h4M10 3v6L6 20a.7.7 0 0 0 .5 1h11a.7.7 0 0 0 .5-1l-4-11V3',
    light: '#A16207',
    dark: '#FFC233',
  },
  Infrastructure: {
    path: 'M6 4h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM6 12h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3zM7 8v.01M7 16v.01',
    light: '#52606A',
    dark: '#8FA3AD',
  },
  Security: {
    path: 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3',
    light: '#C62828',
    dark: '#FF5A5A',
  },
  Organization: {
    path: 'M5 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85',
    light: '#8A5A2B',
    dark: '#D9B38C',
  },
  Knowledge: {
    path: 'M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13',
    light: '#0369A1',
    dark: '#7FD1FF',
  },
  Harness: {
    path: 'M8 4h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 2v2M9 12v9M15 12v9M5 16l4-2M15 14l4 2M9 18h6M10 8v.01M14 8v.01',
    light: '#B85042',
    dark: '#E07A66',
  },
};

/** A type outside the list: a folder in the neutral colours. */
const OTHER = {
  path: 'M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  light: '#52606A',
  dark: '#9AA7AE',
};

const domain = (type: string) => DOMAINS[type.split('/')[0] ?? ''] ?? OTHER;

/** Colour of the main type of `type` in `scheme`. */
export function domainColour(type: string, scheme: Scheme): string {
  return domain(type)[scheme];
}

/** Glyph of the main type of `type`. */
export function DomainIcon({ type, size, color }: { type: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={domain(type).path} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Glyph of the main type of `type` in a circle tinted with its colour. */
export function DomainBadge({ type, size = 26 }: { type: string; size?: number }) {
  const colour = domainColour(type, useTheme().scheme);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colour + '29',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <DomainIcon type={type} size={Math.round(size * 0.58)} color={colour} />
    </View>
  );
}
