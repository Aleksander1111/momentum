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

/**
 * An angle for a 3D turn, kept off exactly 0°: a layer turned by exactly 0° is drawn flat by the browser, a little
 * softer or sharper than the frames either side, and flickers. A twentieth of a degree is never seen.
 */
export const turned = (deg: number) => (Math.abs(deg % 180) < 0.05 ? deg + 0.05 : deg);

/** Text as typed so far: `cps` characters a second from `start` */
export function typed(text: string, frame: number, start: number, cps = 28): string {
  return text.slice(0, Math.max(0, Math.floor(((frame - start) * cps) / FPS)));
}

/**
 * Reading time: at each `[at, frames]` the scene stops at scene frame `at` for `frames` real frames, so a line can be
 * said in full. A hold is only ever placed where the measured picture is still, so stopping there cannot be seen; what
 * moves for ever (a pulse, a bob, a drift) runs on the real clock, `useAmbientFrame`, and never stops.
 */
export type Dwell = [at: number, frames: number];

/** The scene's own time at a real frame */
export function dwell(frame: number, dwells: Dwell[]): number {
  let added = 0;
  for (const [at, frames] of dwells) {
    const start = at + added;
    if (frame < start) break;
    if (frame < start + frames) return at;
    added += frames;
  }
  return frame - added;
}

/** How many real frames a scene of `frames` scene frames lasts with its dwells */
export const dwelt = (frames: number, dwells: Dwell[]) => frames + dwells.reduce((s, [, n]) => s + n, 0);

/** Set while measuring where a scene is still: its own time, unheld */
export const Unheld = createContext(false);

/** The real clock, for what moves for ever: never held, and stopped while a scene is measured so it never counts as motion */
export function useAmbientFrame(): number {
  const frame = useCurrentFrame();
  return useContext(Unheld) ? 0 : frame;
}

/** The scene's own time at the current frame, held for its lines unless being measured */
export function useSceneFrame(dwells: Dwell[]): number {
  const frame = useCurrentFrame();
  return useContext(Unheld) ? frame : dwell(frame, dwells);
}
