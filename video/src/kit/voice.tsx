// The narration: a line per beat of each scene. The voice sets the tempo: a beat holds, slowed to a fifth at its
// settled point, until its line has been said and a pause has passed, so nothing moves on while it is still being told.
import { Audio, Sequence, staticFile } from 'remotion';
import stillness from '../stillness.json';
import timing from '../voice.json';
import { dwell, dwellFor, dwellSpan, STOP, type Dwell } from './motion.ts';

/** A line, said from scene frame `at`; the scene holds at `hold` until it is over */
export interface Cue {
  at: number;
  hold: number;
  text: string;
  /** Frames the beat stays after its line, beyond the usual pause: for a picture that needs looking at */
  rest?: number;
}

/** Each line's recording and its length in frames, written by scripts/voice.ts */
export const TIMING = timing as Record<string, { file: string; frames: number; text: string; voice?: string }>;
export const lineKey = (scene: string, i: number) => `${scene}-${i}`;
const framesOf = (scene: string, i: number, cue: Cue) => {
  const t = TIMING[lineKey(scene, i)];
  // A line written since the last recording: timed as if read at two and a half words a second
  return t && t.text === cue.text ? t.frames : Math.round((cue.text.split(' ').length / 2.5) * 30);
};

/** Silence after each line before the next one, and the least a beat ever holds, in frames */
const PAUSE = 21;
const LEAST = 24;
/** Frames the next scene takes over in */
export const HANDOVER = 28;

/** How much each frame of each scene differs from the one before, measured by scripts/stillness.ts */
const MOTION = stillness as Record<string, number[]>;
/** Below this mean change a pixel, the picture reads as still */
const STILL = 0.5;
/** A gentle slowdown, for a beat whose picture never stands still */
const GLIDE = 0.55;

/**
 * The holds a scene of `frames` frames needs for its lines: each beat stays until its line has been said and a pause
 * has passed. The time is added where the picture stands still, nearest the moment the beat was written to rest on;
 * a beat that never stands still is slowed a little over its whole length instead.
 */
export function voiceDwells(scene: string, cues: Cue[], frames: number): Dwell[] {
  const motion = MOTION[scene] ?? [];
  const still = (from: number, to: number) => {
    const w = motion.slice(Math.round(from), Math.round(to));
    return w.length > 0 && w.reduce((s, x) => s + x, 0) / w.length < STILL;
  };
  const dwells: Dwell[] = [];
  cues.forEach((cue, i) => {
    const next = i + 1 < cues.length ? cues[i + 1]!.at : frames - HANDOVER;
    const need = framesOf(scene, i, cue) + PAUSE + (cue.rest ?? 0) - (next - cue.at);
    // A still moment in the beat, long enough to hold in, nearest where the beat was meant to rest
    const len = Math.max(LEAST, dwellFor(need));
    const span = Math.ceil(dwellSpan(len)) + 4;
    const starts = Array.from({ length: Math.max(0, Math.floor(next - span - cue.at - 4)) }, (_, k) => cue.at + 4 + k).filter((h) => still(h - 4, h + span));
    if (starts.length) {
      const at = starts.reduce((a, b) => (Math.abs(b - cue.hold) < Math.abs(a - cue.hold) ? b : a));
      dwells.push([Math.round(at), Math.round(len), STOP]);
    } else if (need > 0) {
      // Never still: the whole beat a little slower, never a stall
      const glide = dwellFor(need, GLIDE);
      const at = Math.max(cue.at + 2, next - dwellSpan(glide, GLIDE) - 2);
      dwells.push([Math.round(at), Math.round(glide), GLIDE]);
    }
  });
  return dwells;
}

/** The real frame a scene frame is shown at, once held */
export function realFrame(at: number, dwells: Dwell[]): number {
  let r = Math.floor(at);
  while (dwell(r, dwells) < at) r++;
  return r;
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
