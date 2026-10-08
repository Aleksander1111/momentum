// The narration: a line per beat of each scene. The voice sets the tempo: a beat holds, slowed to a fifth at its
// settled point, until its line has been said and a pause has passed, so nothing moves on while it is still being told.
import { Audio, Sequence, staticFile } from 'remotion';
import timing from '../voice.json';
import { dwell, type Dwell } from './motion.ts';

/** A line, said from scene frame `at`; the scene holds at `hold` until it is over */
export interface Cue {
  at: number;
  hold: number;
  text: string;
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
const HANDOVER = 20;
const RATE = 0.2;

/** The holds a scene of `frames` frames needs for its lines */
export function voiceDwells(scene: string, cues: Cue[], frames: number): Dwell[] {
  const dwells: Dwell[] = [];
  cues.forEach((cue, i) => {
    const next = i + 1 < cues.length ? cues[i + 1]!.at : frames - HANDOVER;
    const gap = next - cue.at;
    const need = framesOf(scene, i, cue) + PAUSE - gap;
    const len = Math.max(LEAST, need / (1 - RATE));
    // Held early enough that the slowed beat is over before the next line's beat starts
    const hold = Math.max(cue.at, Math.min(cue.hold, next - len * RATE - 2));
    dwells.push([Math.round(hold), Math.round(len)]);
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
