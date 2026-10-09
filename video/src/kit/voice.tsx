// The narration: a line per beat of each scene. The voice sets the tempo: a beat stops at a moment its picture stands
// still until its line has been said and a pause has passed, so nothing moves on while it is still being told.
import { Audio, interpolate, Sequence, staticFile } from 'remotion';
import stillness from '../stillness.json';
import timing from '../voice.json';
import { dwell, useAmbientFrame, type Dwell } from './motion.ts';

/** A line, said from scene frame `at`; the scene holds at `hold` until it is over */
export interface Cue {
  at: number;
  hold: number;
  text: string;
  /** Frames the beat stays after its line, beyond the usual pause: for a picture that needs looking at */
  rest?: number;
}

/** Each line's recording and its length in frames, written by scripts/listen.py --pick */
export const TIMING = timing as Record<string, { file: string; frames: number; text: string; voice?: string }>;
export const lineKey = (scene: string, i: number) => `${scene}-${i}`;
const framesOf = (scene: string, i: number, cue: Cue) => {
  const t = TIMING[lineKey(scene, i)];
  // A line written since the last recording: timed as if read at two and a half words a second
  return t && t.text === cue.text ? t.frames : Math.round((cue.text.split(' ').length / 2.5) * 30);
};

/** Silence after each line before the next one, in frames */
export const PAUSE = 21;
/** Frames the next scene takes over in */
export const HANDOVER = 28;

/** How much each frame of each scene differs from the one before, measured by scripts/stillness.ts */
export const MOTION = stillness as Record<string, number[]>;
/** Below this mean change a pixel, over a few frames either side, the picture reads as still */
export const STILL = 0.3;
const AROUND = 3;
export const stillAt = (scene: string, h: number) => {
  const w = (MOTION[scene] ?? []).slice(h - AROUND, h + AROUND + 1);
  return w.length === 2 * AROUND + 1 && Math.max(...w) < STILL;
};

/** Where beat `i` ends: the next line's start, or for the last, where the next scene starts taking over */
export const beatEnd = (cues: Cue[], i: number, frames: number) => (i + 1 < cues.length ? cues[i + 1]!.at : frames - HANDOVER);

/** Real frames beat `i` must last beyond its own length, for its line, a pause, and any rest */
export const shortBy = (scene: string, cues: Cue[], i: number, frames: number) => {
  const cue = cues[i]!;
  return framesOf(scene, i, cue) + PAUSE + (cue.rest ?? 0) - (beatEnd(cues, i, frames) - cue.at);
};

/**
 * The holds a scene of `frames` frames needs for its lines: a beat too short for its line stops, for the difference,
 * at the moment of the beat its picture stands still that is nearest where the beat was written to rest. A beat that
 * never stands still gets no hold: scripts/validate.ts fails it, and the scene has to be given the time.
 */
export function voiceDwells(scene: string, cues: Cue[], frames: number): Dwell[] {
  const dwells: Dwell[] = [];
  cues.forEach((cue, i) => {
    const need = Math.ceil(shortBy(scene, cues, i, frames));
    if (need <= 0) return;
    const end = beatEnd(cues, i, frames);
    const still = Array.from({ length: Math.max(0, Math.floor(end - cue.at) - 1) }, (_, k) => Math.ceil(cue.at) + 1 + k).filter((h) => h < end && stillAt(scene, h));
    if (!still.length) return;
    const at = still.reduce((a, b) => (Math.abs(b - cue.hold) < Math.abs(a - cue.hold) ? b : a));
    dwells.push([at, need]);
  });
  return dwells;
}

/** The real frame a scene frame is shown at, once held */
export function realFrame(at: number, dwells: Dwell[]): number {
  let r = Math.floor(at);
  while (dwell(r, dwells) < at) r++;
  return r;
}

/**
 * A slow camera drift, 0 to 1 from scene frame `from` to the scene's end, on the real clock: it goes on at one speed
 * through every hold, so a held beat never looks frozen, and it is left out while the scene is measured for stillness
 */
export function useDrift(from: number, dwells: Dwell[], length: number): number {
  const real = useAmbientFrame();
  const start = realFrame(from, dwells);
  return real <= 0 ? 0 : interpolate(real, [start, length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** The scene's lines, each starting at its beat */
export function Voice({ scene, cues, dwells }: { scene: string; cues: Cue[]; dwells: Dwell[] }) {
  return (
    <>
      {cues.map((cue, i) => {
        const t = TIMING[lineKey(scene, i)];
        if (!t || t.text !== cue.text) return null;
        return (
          <Sequence key={i} from={realFrame(cue.at, dwells)} layout="none">
            <Audio src={staticFile(`voice/${t.file}`)} />
          </Sequence>
        );
      })}
    </>
  );
}
