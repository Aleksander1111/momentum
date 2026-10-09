import { Composition } from 'remotion';
import type { ComponentType } from 'react';
import { FPS, Unheld } from './kit/motion.ts';
import { Momentum, MOMENTUM_FRAMES } from './Momentum.tsx';
import { LayoutAudit } from './kit/audit.tsx';
import { Hook, HOOK_FRAMES, HOOK_LENGTH } from './scenes/Hook.tsx';
import { Layers, LAYERS_FRAMES, LAYERS_LENGTH } from './scenes/Layers.tsx';
import { Swipe, SWIPE_FRAMES, SWIPE_LENGTH } from './scenes/Swipe.tsx';
import { Loop, LOOP_FRAMES, LOOP_LENGTH } from './scenes/Loop.tsx';
import { Graph, GRAPH_FRAMES, GRAPH_LENGTH } from './scenes/Graph.tsx';
import { Schedule, SCHEDULE_FRAMES, SCHEDULE_LENGTH } from './scenes/Schedule.tsx';
import { Learn, LEARN_FRAMES, LEARN_LENGTH } from './scenes/Learn.tsx';
import { Measure, MEASURE_FRAMES, MEASURE_LENGTH } from './scenes/Measure.tsx';
import { Resolve, RESOLVE_FRAMES, RESOLVE_LENGTH } from './scenes/Resolve.tsx';
import { Line, LINE_FRAMES, LINE_LENGTH } from './scenes/Line.tsx';

/** The whole cut, measured frame by frame by scripts/audit.ts */
function Audited() {
  return (
    <>
      <Momentum />
      <LayoutAudit />
    </>
  );
}

/** A scene in its own time, never held: scripts/stillness.ts measures where its picture stands still */
const unheld = (Scene: ComponentType) =>
  function UnheldScene() {
    return (
      <Unheld.Provider value={true}>
        <Scene />
      </Unheld.Provider>
    );
  };

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
  { id: 'Unheld-Hook', component: unheld(Hook), frames: HOOK_FRAMES },
  { id: 'Unheld-Layers', component: unheld(Layers), frames: LAYERS_FRAMES },
  { id: 'Unheld-Swipe', component: unheld(Swipe), frames: SWIPE_FRAMES },
  { id: 'Unheld-Loop', component: unheld(Loop), frames: LOOP_FRAMES },
  { id: 'Unheld-Graph', component: unheld(Graph), frames: GRAPH_FRAMES },
  { id: 'Unheld-Schedule', component: unheld(Schedule), frames: SCHEDULE_FRAMES },
  { id: 'Unheld-Learn', component: unheld(Learn), frames: LEARN_FRAMES },
  { id: 'Unheld-Measure', component: unheld(Measure), frames: MEASURE_FRAMES },
  { id: 'Unheld-Resolve', component: unheld(Resolve), frames: RESOLVE_FRAMES },
  { id: 'Unheld-Line', component: unheld(Line), frames: LINE_FRAMES },
];

export function Root() {
  return (
    <>
      {SCENES.map((s) => (
        <Composition key={s.id} id={s.id} component={s.component as ComponentType<Record<string, unknown>>} durationInFrames={s.frames} fps={FPS} width={1920} height={1080} />
      ))}
    </>
  );
}
