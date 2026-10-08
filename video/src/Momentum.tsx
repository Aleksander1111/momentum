// The whole video: the problem, then the three layers in turn, each scene handing over to the next with its own transition
import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import type { ComponentType } from 'react';
import type { ReactNode } from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { FPS } from './kit/motion.ts';
import { C } from './kit/theme.ts';
import { iris, push, zoomThrough } from './kit/transitions.tsx';
import { lineKey, realFrame, TIMING, voiceDwells, type Cue } from './kit/voice.tsx';
import { Graph, GRAPH_CUES, GRAPH_FRAMES, GRAPH_LENGTH } from './scenes/Graph.tsx';
import { Hook, HOOK_CUES, HOOK_FRAMES, HOOK_LENGTH } from './scenes/Hook.tsx';
import { Layers, LAYERS_CUES, LAYERS_FRAMES, LAYERS_LENGTH } from './scenes/Layers.tsx';
import { Learn, LEARN_CUES, LEARN_FRAMES, LEARN_LENGTH } from './scenes/Learn.tsx';
import { Line, LINE_CUES, LINE_FRAMES, LINE_LENGTH } from './scenes/Line.tsx';
import { Loop, LOOP_CUES, LOOP_FRAMES, LOOP_LENGTH } from './scenes/Loop.tsx';
import { Measure, MEASURE_CUES, MEASURE_FRAMES, MEASURE_LENGTH } from './scenes/Measure.tsx';
import { Resolve, RESOLVE_CUES, RESOLVE_FRAMES, RESOLVE_LENGTH } from './scenes/Resolve.tsx';
import { Schedule, SCHEDULE_CUES, SCHEDULE_FRAMES, SCHEDULE_LENGTH } from './scenes/Schedule.tsx';
import { Swipe, SWIPE_CUES, SWIPE_FRAMES, SWIPE_LENGTH } from './scenes/Swipe.tsx';

const HANDOVER = 20;

// Each scene, and how the next one takes over from it
const CUT: [ComponentType, number, TransitionPresentation<any> | null][] = [
  // The problem, then the answer in three layers
  [Hook, HOOK_LENGTH, zoomThrough()],
  [Layers, LAYERS_LENGTH, zoomThrough()],
  // Attention: what you do, and the loop that brings it to you
  [Swipe, SWIPE_LENGTH, push('right')],
  [Loop, LOOP_LENGTH, iris(960, 470)],
  // Understanding: the graph, how it is written and measured, how it stays consistent
  [Graph, GRAPH_LENGTH, push('bottom')],
  [Measure, MEASURE_LENGTH, iris(470, 540)],
  [Resolve, RESOLVE_LENGTH, zoomThrough()],
  // Implementation: paced by your attention, improving from what repeats
  [Schedule, SCHEDULE_LENGTH, push('right')],
  [Learn, LEARN_LENGTH, zoomThrough()],
  // One straight line, tuned to you, and the close
  [Line, LINE_LENGTH, null],
];

/** The frame each scene starts at in the cut: the music swells into each one */
export const CUTS = CUT.map((_, i) => CUT.slice(0, i).reduce((sum, [, frames]) => sum + frames - HANDOVER, 0));

/** Every scene's narration, in the order of the cut */
export const SCRIPT: { scene: string; cues: Cue[]; frames: number }[] = [
  { scene: 'Hook', cues: HOOK_CUES, frames: HOOK_FRAMES },
  { scene: 'Layers', cues: LAYERS_CUES, frames: LAYERS_FRAMES },
  { scene: 'Swipe', cues: SWIPE_CUES, frames: SWIPE_FRAMES },
  { scene: 'Loop', cues: LOOP_CUES, frames: LOOP_FRAMES },
  { scene: 'Graph', cues: GRAPH_CUES, frames: GRAPH_FRAMES },
  { scene: 'Measure', cues: MEASURE_CUES, frames: MEASURE_FRAMES },
  { scene: 'Resolve', cues: RESOLVE_CUES, frames: RESOLVE_FRAMES },
  { scene: 'Schedule', cues: SCHEDULE_CUES, frames: SCHEDULE_FRAMES },
  { scene: 'Learn', cues: LEARN_CUES, frames: LEARN_FRAMES },
  { scene: 'Line', cues: LINE_CUES, frames: LINE_FRAMES },
];

/** When each line is said in the whole video, and for how long, in seconds: the music makes room for it */
export const SPOKEN = SCRIPT.flatMap(({ scene, cues, frames }, i) => {
  const dwells = voiceDwells(scene, cues, frames);
  return cues.map((cue, k) => ({
    from: (CUTS[i]! + realFrame(cue.at, dwells)) / FPS,
    seconds: (TIMING[lineKey(scene, k)]?.frames ?? 0) / FPS,
  }));
});

export const MOMENTUM_FRAMES = CUT.reduce((sum, [, frames]) => sum + frames, 0) - (CUT.length - 1) * HANDOVER;

/**
 * A slow drift of the whole frame, like a camera held by hand on a tripod: never still, even while a scene holds for
 * its line
 */
function Breathe({ children }: { children: ReactNode }) {
  const f = useCurrentFrame();
  const scale = 1.012 + 0.012 * Math.sin(f / 97);
  const x = 6 * Math.sin(f / 131);
  const y = 4 * Math.sin(f / 113 + 1);
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}>{children}</AbsoluteFill>;
}

export function Momentum() {
  return (
    // A light ground under every transition: a scene fading out shows the page, never black
    <AbsoluteFill style={{ background: C.behind1 }}>
      {/* Written by scripts/music.ts, timed to CUTS */}
      <Audio src={staticFile('music.wav')} />
      <TransitionSeries>
        {CUT.flatMap(([Scene, frames, next], i) => [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
            <Breathe>
              <Scene />
            </Breathe>
          </TransitionSeries.Sequence>,
          ...(next ? [<TransitionSeries.Transition key={`t${i}`} presentation={next} timing={linearTiming({ durationInFrames: HANDOVER })} />] : []),
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
