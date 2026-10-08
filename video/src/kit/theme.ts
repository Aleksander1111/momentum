// The app's light palette, fonts and glyphs (apps/app/src/ui), so the app on screen is the app

export const C = {
  ink: '#2F3E46',
  muted: '#52606A',
  accent: '#5B5BD6',
  accentSoft: '#9D9DE6',
  ok: '#3F6B52',
  no: '#A0402F',
  warn: '#8A6D2B',
  screen: '#F7F5F0',
  line: '#D5D9D3',
  card: '#EEF1EC',
  surface: '#FFFFFF',
  washNo: '#F4DCD6',
  washWarn: '#EFE8D2',
  washOk: '#DCE7DF',
  behind1: '#FBFAF7',
  behind2: '#F3F1EC',
  stateUnverified: '#C98A00',
  stateVerified: '#16924A',
  stateUpdating: '#7A3FE0',
};

export const F = {
  head: 'Cambria, Georgia, "Times New Roman", serif',
  body: 'Calibri, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'Consolas, monospace',
};

/** The three layers of the harness, coloured as on the deck's first slide */
export const LAYERS = {
  attention: { name: 'Attention', wash: C.washNo, ink: C.no },
  understanding: { name: 'Understanding', wash: C.washWarn, ink: C.warn },
  implementation: { name: 'Implementation', wash: C.washOk, ink: C.ok },
} as const;
export type Layer = keyof typeof LAYERS;

/** Main entity types: a stroked glyph on a 24 grid and its colour (apps/app/src/ui/domains.tsx) */
export const DOMAINS: Record<string, { path: string; color: string }> = {
  Product: { path: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5', color: '#C2410C' },
  Governance: { path: 'M7 20h10M6 6l6-1 6 1M12 3v17M9 12L6 6l-3 6a3 3 0 0 0 6 0M21 12l-3-6-3 6a3 3 0 0 0 6 0', color: '#7C3AED' },
  Architecture: { path: 'M6 7h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2v-4a4 4 0 0 0-8 0v4H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', color: '#1D6FD6' },
  Code: { path: 'M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16', color: '#15803D' },
  Data: { path: 'M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0M4 6v6a8 3 0 0 0 16 0V6M4 12v6a8 3 0 0 0 16 0v-6', color: '#0F766E' },
  Testing: { path: 'M9 3h6M10 9h4M10 3v6L6 20a.7.7 0 0 0 .5 1h11a.7.7 0 0 0 .5-1l-4-11V3', color: '#A16207' },
  Knowledge: { path: 'M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13', color: '#0369A1' },
  Frontend: {
    path: 'M6 4h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    color: '#C0266D',
  },
  Infrastructure: {
    path: 'M6 4h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM6 12h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3zM7 8v.01M7 16v.01',
    color: '#52606A',
  },
  Security: { path: 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3', color: '#C62828' },
  Organization: {
    path: 'M5 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85',
    color: '#8A5A2B',
  },
  Harness: {
    path: 'M8 4h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 2v2M9 12v9M15 12v9M5 16l4-2M15 14l4 2M9 18h6M10 8v.01M14 8v.01',
    color: '#B85042',
  },
};
export const domainOf = (type: string) => DOMAINS[type.split('/')[0] ?? ''] ?? { path: '', color: C.muted };

/** Filled glyphs on a 24 grid (apps/app/src/ui/icons.tsx) */
export const ICONS = {
  feed: 'M12 3 2 8l10 5 10-5-10-5zm-7.6 8.4L2 12.6l10 5 10-5-2.4-1.2L12 15.2zm0 4.2L2 16.8l10 5 10-5-2.4-1.2L12 19.4z',
  explorer: 'M5 3h5v5H5zm9 0h5v5h-5zM9.5 16h5v5h-5zM7.5 8v3h9V8h-1.5v1.5h-6V8zM11.25 11h1.5v5h-1.5z',
  chat: 'M3 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm16 4h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-6a2 2 0 0 1-2-2v-1h7a4 4 0 0 0 4-4z',
  timeline:
    'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5.25l4.5 2.67.77-1.28-3.77-2.24V8z',
  metrics: 'M3 3h2v16h16v2H3zm4 12 4-5 3 3 6-8 1.5 1.2-7.5 10-3-3-2.5 3z',
  settings:
    'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3H9l-.3 2.9a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.7 7.7 0 0 0 1.7 1L9 21h6l.3-2.9a7.7 7.7 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  commit: 'M2 11h5.1a5 5 0 0 1 9.8 0H22v2h-5.1a5 5 0 0 1-9.8 0H2zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  send: 'M3 11 21 3l-8 18-2-8z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v5.6l4.4 2.6.8-1.3-3.7-2.2V7z',
  search: 'M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
} as const;

/** Stroked glyphs of the harness's parts, on a 24 grid */
export const PARTS = {
  shield: 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3M8.5 12l2.5 2.5 4.5-5',
  terminal: 'M4 17l6-5-6-5M12 19h8',
  sparkles: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  pause: 'M8 5v14M16 5v14',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
};

/** Entity states: stroked glyphs (apps/app/src/ui/StateBadge.tsx) */
export const STATES = {
  unverified: { path: 'M8 8a3.5 3 0 0 1 3.5-3h1a3.5 3 0 0 1 3.5 3 3 3 0 0 1-2 3 3 4 0 0 0-2 4M12 19v.01', color: C.stateUnverified },
  verified: { path: 'M5 12l5 5L20 7', color: C.stateVerified },
  updating: { path: 'M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4', color: C.stateUpdating },
} as const;
export type State = keyof typeof STATES;
