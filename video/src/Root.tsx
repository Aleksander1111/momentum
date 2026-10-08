import { Composition } from 'remotion';
import { FPS } from './kit/motion.ts';
import { Momentum, MOMENTUM_FRAMES } from './Momentum.tsx';
import { LayoutAudit } from './kit/audit.tsx';
import { Hook, HOOK_LENGTH } from './scenes/Hook.tsx';
import { Layers, LAYERS_LENGTH } from './scenes/Layers.tsx';
import { Swipe, SWIPE_LENGTH } from './scenes/Swipe.tsx';
import { Loop, LOOP_LENGTH } from './scenes/Loop.tsx';
import { Graph, GRAPH_LENGTH } from './scenes/Graph.tsx';
import { Schedule, SCHEDULE_LENGTH } from './scenes/Schedule.tsx';
import { Learn, LEARN_LENGTH } from './scenes/Learn.tsx';
import { Measure, MEASURE_LENGTH } from './scenes/Measure.tsx';
import { Resolve, RESOLVE_LENGTH } from './scenes/Resolve.tsx';
import { Line, LINE_LENGTH } from './scenes/Line.tsx';

/** The whole cut, measured frame by frame by scripts/audit.ts */
function Audited() {
  return (
    <>
      <Momentum />
      <LayoutAudit />
    </>
  );
}

const SCENES = [
  { id: 'Audit', component: Audited, frames: MOMENTUM_FRAMES },
  { id: 'Momentum', component: Momentum, frames: MOMENTUM_FRAMES },
  { id: 'Hook', component: Hook, frames: HOOK_LENGTH },
  { id: 'Layers', component: Layers, frames: LAYERS_LENGTH },
  { id: 'Swipe', component: Swipe, frames: SWIPE_LENGTH },
  { id: 'Loop', component: Loop, frames: LOOP_LENGTH },
  { id: 'Graph', component: Graph, frames: GRAPH_LENGTH },
  { id: 'Schedule', component: Schedule, frames: SCHEDULE_LENGTH },
  { id: 'Learn', component: Learn, frames: LEARN_LENGTH },
  { id: 'Measure', component: Measure, frames: MEASURE_LENGTH },
  { id: 'Resolve', component: Resolve, frames: RESOLVE_LENGTH },
  { id: 'Line', component: Line, frames: LINE_LENGTH },
];

export function Root() {
  return (
    <>
      {SCENES.map((s) => (
        <Composition key={s.id} id={s.id} component={s.component} durationInFrames={s.frames} fps={FPS} width={1920} height={1080} />
      ))}
    </>
  );
}
