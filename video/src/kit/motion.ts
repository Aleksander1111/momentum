import { Easing, interpolate, spring } from 'remotion';

export const FPS = 30;

/** 0 before `start`, 1 after `start + frames`, eased between */
export function ramp(frame: number, start: number, frames: number, easing = Easing.inOut(Easing.cubic)): number {
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
 * Reading time: at each `[at, frames]` the scene's time slows to a fifth for `frames` real frames, so what has just
 * settled stays on screen long enough to read, while whatever still moves keeps moving, slowly.
 */
export type Dwell = [at: number, frames: number];
const DWELL_RATE = 0.2;

/** The scene's own time at a real frame */
export function dwell(frame: number, dwells: Dwell[]): number {
  let added = 0;
  for (const [at, frames] of dwells) {
    const start = at + added;
    if (frame < start) break;
    if (frame < start + frames) return at + (frame - start) * DWELL_RATE;
    added += frames * (1 - DWELL_RATE);
  }
  return frame - added;
}

/** How many real frames a scene of `frames` scene frames lasts with its dwells */
export const dwelt = (frames: number, dwells: Dwell[]) => Math.round(frames + dwells.reduce((s, [, n]) => s + n * (1 - DWELL_RATE), 0));
