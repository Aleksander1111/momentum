// The whole video: the scenes in the deck's order, each handing over to the next with its own transition
import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import type { ComponentType } from 'react';
import { iris, push, zoomThrough } from './kit/transitions.tsx';
import { Graph, GRAPH_FRAMES } from './scenes/Graph.tsx';
import { Layers, LAYERS_FRAMES } from './scenes/Layers.tsx';
import { Learn, LEARN_FRAMES } from './scenes/Learn.tsx';
import { Line, LINE_FRAMES } from './scenes/Line.tsx';
import { Loop, LOOP_FRAMES } from './scenes/Loop.tsx';
import { Measure, MEASURE_FRAMES } from './scenes/Measure.tsx';
import { Resolve, RESOLVE_FRAMES } from './scenes/Resolve.tsx';
import { Schedule, SCHEDULE_FRAMES } from './scenes/Schedule.tsx';
import { Swipe, SWIPE_FRAMES } from './scenes/Swipe.tsx';

const HANDOVER = 20;

// Each scene, and how the next one takes over from it
const CUT: [ComponentType, number, TransitionPresentation<any> | null][] = [
  [Layers, LAYERS_FRAMES, zoomThrough()],
  [Swipe, SWIPE_FRAMES, push('right')],
  [Loop, LOOP_FRAMES, iris(1270, 380)],
  [Graph, GRAPH_FRAMES, push('bottom')],
  [Schedule, SCHEDULE_FRAMES, zoomThrough()],
  [Learn, LEARN_FRAMES, push('right')],
  [Measure, MEASURE_FRAMES, iris(1130, 540)],
  [Resolve, RESOLVE_FRAMES, zoomThrough()],
  [Line, LINE_FRAMES, null],
];

export const MOMENTUM_FRAMES = CUT.reduce((sum, [, frames]) => sum + frames, 0) - (CUT.length - 1) * HANDOVER;

export function Momentum() {
  return (
    <TransitionSeries>
      {CUT.flatMap(([Scene, frames, next], i) => [
        <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
          <Scene />
        </TransitionSeries.Sequence>,
        ...(next ? [<TransitionSeries.Transition key={`t${i}`} presentation={next} timing={linearTiming({ durationInFrames: HANDOVER })} />] : []),
      ])}
    </TransitionSeries>
  );
}
