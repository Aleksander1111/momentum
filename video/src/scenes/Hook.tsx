// The opening, before the layers: the problem. Changes from a dozen projects pop up faster and faster until they bury
// the frame and the count of the day runs into the thousands; then all of it is drawn into one point, the place the
// next scene opens as the feed.
import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Glyph, ProjectMark, type Project } from '../kit/app.tsx';
import { Backdrop } from '../kit/stage.tsx';
import { C, DOMAINS, F, ICONS, PARTS } from '../kit/theme.ts';
import { dwell, dwelt, mix, pop, ramp, type Dwell } from '../kit/motion.ts';

export const HOOK_FRAMES = 240;

const PROJECTS: Project[] = [
  { name: 'bookshelf-api', color: '#1D6FD6' },
  { name: 'handbook', color: '#7C3AED' },
  { name: 'notes-api', color: '#0F766E' },
  { name: 'todo-cli', color: '#C2410C' },
  { name: 'billing', color: '#C0266D' },
  { name: 'mobile-app', color: '#15803D' },
  { name: 'data-pipeline', color: '#A16207' },
  { name: 'auth-service', color: '#C62828' },
  { name: 'marketing-site', color: '#0369A1' },
  { name: 'infra', color: '#52606A' },
  { name: 'design-system', color: '#8A5A2B' },
  { name: 'search', color: '#5B5BD6' },
];

const KINDS: [string, string, string, string[]][] = [
  ['Commit', ICONS.commit, C.ok, ['Fix pagination off by one', 'Bump dependencies', 'Refactor the store', 'Add retry on timeout']],
  ['Pull request', DOMAINS.Code!.path, C.accent, ['Search by author', 'Dark mode toggle', 'Cache invoices', 'New onboarding flow']],
  ['Doc changed', DOMAINS.Knowledge!.path, '#0369A1', ['Remote work policy', 'API reference', 'Release notes', 'Runbook: failover']],
  ['Test failed', DOMAINS.Testing!.path, C.no, ['books.test.js: 2 failing', 'e2e: checkout times out', 'flaky: login spec', 'lint: 14 errors']],
  ['Issue', PARTS.bolt, C.warn, ['Duplicate ISBNs', 'Slow dashboard', 'Wrong currency', 'Crash on resume']],
];

// A hundred changes, each at a place and a moment: sparse at first, then a flood
const N = 110;
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const ITEMS = Array.from({ length: N }, (_, i) => ({
  at: 10 + 140 * (i / N) ** 0.55,
  x: 80 + rand(i, 1) * 1560,
  y: 150 + rand(i, 2) * 820,
  rot: (rand(i, 3) - 0.5) * 10,
  project: PROJECTS[Math.floor(rand(i, 4) * PROJECTS.length)]!,
  kind: KINDS[Math.floor(rand(i, 5) * KINDS.length)]!,
  title: Math.floor(rand(i, 6) * 4),
}));

// Beats
const PULL = 170;
const ONE = 196;

function Item({ f, i }: { f: number; i: number }) {
  const it = ITEMS[i]!;
  if (f < it.at) return null;
  const t = pop(f, it.at, true);
  const pull = ramp(f, PULL + (i % 12) * 1.2, 22, Easing.in(Easing.cubic));
  const [kind, glyph, color, titles] = it.kind;
  const x = mix(pull, it.x, 960 - 150);
  const y = mix(pull, it.y, 560 - 40);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 300,
        transform: `rotate(${it.rot * (1 - pull)}deg) scale(${t * (1 - pull * 0.92)})`,
        opacity: 1 - ramp(f, PULL + 18 + (i % 12) * 1.2, 6),
        background: C.surface,
        borderRadius: 14,
        border: `1px solid ${C.line}`,
        borderLeft: `5px solid ${color}`,
        padding: '10px 14px',
        boxShadow: '0 10px 24px rgba(30,41,59,.14)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ProjectMark project={it.project} size={20} />
        <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 14, color: C.muted, flex: 1 }}>{it.project.name}</span>
        <Glyph path={glyph} size={16} color={color} stroke={glyph !== ICONS.commit} />
        <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 13, color }}>{kind}</span>
      </div>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 19, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titles[it.title]}</div>
    </div>
  );
}

/** A line of the hook, large, over whatever lies behind it */
function Line({ f, from, to, top = 440, children }: { f: number; from: number; to: number; top?: number; children: ReactNode }) {
  if (f < from || f > to) return null;
  const t = ramp(f, from, 12, Easing.out(Easing.cubic)) * (1 - ramp(f, to - 8, 8));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: t, transform: `scale(${mix(t, 0.94, 1)})` }}>
      <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 28, padding: '18px 48px', boxShadow: '0 30px 80px rgba(30,41,59,.25)', fontFamily: F.head, fontWeight: 700, fontSize: 84, color: C.ink, whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  );
}

const DWELLS: Dwell[] = [
  [70, 30],
  [ONE + 14, 40],
];
export const HOOK_LENGTH = dwelt(HOOK_FRAMES, DWELLS);

export function Hook() {
  const f = dwell(useCurrentFrame(), DWELLS);
  const count = Math.round(1284 * ramp(f, 6, PULL - 6, Easing.in(Easing.quad)));
  const projects = Math.min(PROJECTS.length, 1 + Math.floor(f / 10));
  const counterOut = ramp(f, PULL, 14);
  const dot = pop(f, PULL + 24, true);
  return (
    <AbsoluteFill>
      <Backdrop />
      {ITEMS.map((_, i) => (
        <Item key={i} f={f} i={i} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 46, display: 'flex', justifyContent: 'center', gap: 22, opacity: ramp(f, 2, 10) * (1 - counterOut) }}>
        {[
          [String(projects), 'projects'],
          [count.toLocaleString('en-GB'), 'changes today'],
        ].map(([n, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, background: C.ink, color: '#fff', borderRadius: 999, padding: '12px 30px', boxShadow: '0 16px 40px rgba(30,41,59,.3)' }}>
            <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 46 }}>{n}</span>
            <span style={{ fontFamily: F.body, fontSize: 26, opacity: 0.85 }}>{label}</span>
          </div>
        ))}
      </div>
      <Line f={f} from={28} to={104}>Your projects never stop.</Line>
      <Line f={f} from={108} to={PULL}>Nobody reads it all.</Line>
      {/* Everything drawn into one point */}
      <div style={{ position: 'absolute', left: 960 - 30, top: 560 - 30, width: 60, height: 60, borderRadius: 30, background: C.accent, transform: `scale(${dot})`, boxShadow: `0 0 ${60 * dot}px ${C.accent}` }} />
      <Line f={f} from={ONE} to={HOOK_FRAMES + 40} top={680}>
        So it comes to you, <span style={{ color: C.accent }}>in one place.</span>
      </Line>
    </AbsoluteFill>
  );
}
