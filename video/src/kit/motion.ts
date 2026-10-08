import { createContext, useContext } from 'react';
import { Easing, interpolate, spring, useCurrentFrame } from 'remotion';

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
 * Reading time: at each `[at, frames, rate]` the scene eases down to `rate` of its speed for `frames` real frames and
 * eases back, so a line can be said in full. Where the picture is still, the rate is a near stop no one can see; where
 * it never stops, a gentle slowdown spread over the beat.
 */
export type Dwell = [at: number, frames: number, rate?: number];
/** The rate of a hold at a still picture, and the frames it takes to slow down and to speed up again */
export const STOP = 0.04;
const EASE = 12;
const smooth = (x: number) => x * x * x - (x * x * x * x) / 2;

/** Scene frames a hold of `len` real frames at `rate` moves on by */
export const dwellSpan = (len: number, rate = STOP) => {
  const r = Math.min(EASE, len / 2);
  return r + rate * (len - r);
};
/** Real frames a hold at `rate` needs to add `extra` frames to the scene's length */
export const dwellFor = (extra: number, rate = STOP) => EASE + extra / (1 - rate);

/** How far into a hold of `len` frames at `rate` the scene is, `u` real frames in */
function held(u: number, len: number, rate: number): number {
  const r = Math.min(EASE, len / 2);
  if (u < r) return u - (1 - rate) * r * smooth(u / r);
  const slowed = r - ((1 - rate) * r) / 2;
  if (u < len - r) return slowed + rate * (u - r);
  const x = (u - (len - r)) / r;
  return slowed + rate * (len - 2 * r) + rate * r * x + (1 - rate) * r * smooth(x);
}

/** The scene's own time at a real frame */
export function dwell(frame: number, dwells: Dwell[]): number {
  let added = 0;
  for (const [at, frames, rate = STOP] of dwells) {
    const start = at + added;
    if (frame < start) break;
    if (frame < start + frames) return at + held(frame - start, frames, rate);
    added += frames - dwellSpan(frames, rate);
  }
  return frame - added;
}

/** How many real frames a scene of `frames` scene frames lasts with its dwells */
export const dwelt = (frames: number, dwells: Dwell[]) => Math.round(frames + dwells.reduce((s, [, n, rate]) => s + n - dwellSpan(n, rate), 0));

/** Set while measuring where a scene is still: its own time, unheld */
export const Unheld = createContext(false);

/** The scene's own time at the current frame, held for its lines unless being measured */
export function useSceneFrame(dwells: Dwell[]): number {
  const frame = useCurrentFrame();
  return useContext(Unheld) ? frame : dwell(frame, dwells);
}
