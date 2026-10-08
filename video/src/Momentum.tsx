// The whole video: the problem, then the three layers in turn, each scene handing over to the next with its own transition
import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import type { ComponentType } from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from './kit/theme.ts';
import { iris, push, zoomThrough } from './kit/transitions.tsx';
import { Graph, GRAPH_LENGTH } from './scenes/Graph.tsx';
import { Hook, HOOK_LENGTH } from './scenes/Hook.tsx';
import { Layers, LAYERS_LENGTH } from './scenes/Layers.tsx';
import { Learn, LEARN_LENGTH } from './scenes/Learn.tsx';
import { Line, LINE_LENGTH } from './scenes/Line.tsx';
import { Loop, LOOP_LENGTH } from './scenes/Loop.tsx';
import { Measure, MEASURE_LENGTH } from './scenes/Measure.tsx';
import { Resolve, RESOLVE_LENGTH } from './scenes/Resolve.tsx';
import { Schedule, SCHEDULE_LENGTH } from './scenes/Schedule.tsx';
import { Swipe, SWIPE_LENGTH } from './scenes/Swipe.tsx';

const HANDOVER = 20;

// Each scene, and how the next one takes over from it
const CUT: [ComponentType, number, TransitionPresentation<any> | null][] = [
  // The problem, then the answer in three layers
  [Hook, HOOK_LENGTH, zoomThrough()],
  [Layers, LAYERS_LENGTH, zoomThrough()],
  // Attention: what you do, and the loop that brings it to you
  [Swipe, SWIPE_LENGTH, push('right')],
  [Loop, LOOP_LENGTH, iris(1270, 380)],
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

export const MOMENTUM_FRAMES = CUT.reduce((sum, [, frames]) => sum + frames, 0) - (CUT.length - 1) * HANDOVER;

export function Momentum() {
  return (
    // A light ground under every transition: a scene fading out shows the page, never black
    <AbsoluteFill style={{ background: C.behind1 }}>
      <TransitionSeries>
        {CUT.flatMap(([Scene, frames, next], i) => [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
            <Scene />
          </TransitionSeries.Sequence>,
          ...(next ? [<TransitionSeries.Transition key={`t${i}`} presentation={next} timing={linearTiming({ durationInFrames: HANDOVER })} />] : []),
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
