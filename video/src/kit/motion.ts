import { Easing, interpolate, spring } from 'remotion';

export const FPS = 30;

/** The standard curve of material motion: off quickly, settling slowly, as things that have weight do */
const NATURAL = Easing.bezier(0.4, 0, 0.2, 1);

/** 0 before `start`, 1 after `start + frames`, eased between */
export function ramp(frame: number, start: number, frames: number, easing = NATURAL): number {
  return interpolate(frame, [start, start + frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

/** A spring from 0 to 1 starting at `start`: settles without bouncing unless `bouncy` */
export function pop(frame: number, start: number, bouncy = false): number {
  return spring({ frame: frame - start, fps: FPS, config: bouncy ? { damping: 12, stiffness: 140 } : { damping: 200 } });
}

export const mix = (t: number, a: number, b: number) => a + (b - a) * t;

/** Text as typed so far: `cps` characters a second from `start` */
export function typed(text: string, frame: number, start: number, cps = 28): string {
  return text.slice(0, Math.max(0, Math.floor(((frame - start) * cps) / FPS)));
}

/**
 * Reading time: at each `[at, frames]` the scene eases almost to a stop for `frames` real frames and eases back, so
 * what has just settled stays on screen while its line is said. Not slow motion: a fifth of a second to slow down, a
 * near stop, a fifth of a second to speed up.
 */
export type Dwell = [at: number, frames: number];
/** How fast the scene still moves while held, and the frames it takes to slow down and to speed up again */
const HELD = 0.04;
const EASE = 12;
const smooth = (x: number) => x * x * x - (x * x * x * x) / 2;

/** Scene frames a hold of `len` real frames moves on by */
export const dwellSpan = (len: number) => {
  const r = Math.min(EASE, len / 2);
  return r + HELD * (len - r);
};
/** Real frames a hold needs to add `extra` frames to the scene's length */
export const dwellFor = (extra: number) => EASE + extra / (1 - HELD);

/** How far into a hold of `len` frames the scene is, `u` real frames in */
function held(u: number, len: number): number {
  const r = Math.min(EASE, len / 2);
  if (u < r) return u - (1 - HELD) * r * smooth(u / r);
  const slowed = r - ((1 - HELD) * r) / 2;
  if (u < len - r) return slowed + HELD * (u - r);
  const x = (u - (len - r)) / r;
  return slowed + HELD * (len - 2 * r) + HELD * r * x + (1 - HELD) * r * smooth(x);
}

/** The scene's own time at a real frame */
export function dwell(frame: number, dwells: Dwell[]): number {
  let added = 0;
  for (const [at, frames] of dwells) {
    const start = at + added;
    if (frame < start) break;
    if (frame < start + frames) return at + held(frame - start, frames);
    added += frames - dwellSpan(frames);
  }
  return frame - added;
}

/** How many real frames a scene of `frames` scene frames lasts with its dwells */
export const dwelt = (frames: number, dwells: Dwell[]) => Math.round(frames + dwells.reduce((s, [, n]) => s + n - dwellSpan(n), 0));
