import { Composition } from 'remotion';
import { FPS } from './kit/motion.ts';
import { Layers, LAYERS_FRAMES } from './scenes/Layers.tsx';
import { Swipe, SWIPE_FRAMES } from './scenes/Swipe.tsx';
import { Loop, LOOP_FRAMES } from './scenes/Loop.tsx';
import { Graph, GRAPH_FRAMES } from './scenes/Graph.tsx';
import { Schedule, SCHEDULE_FRAMES } from './scenes/Schedule.tsx';
import { Learn, LEARN_FRAMES } from './scenes/Learn.tsx';

const SCENES = [
  { id: 'Layers', component: Layers, frames: LAYERS_FRAMES },
  { id: 'Swipe', component: Swipe, frames: SWIPE_FRAMES },
  { id: 'Loop', component: Loop, frames: LOOP_FRAMES },
  { id: 'Graph', component: Graph, frames: GRAPH_FRAMES },
  { id: 'Schedule', component: Schedule, frames: SCHEDULE_FRAMES },
  { id: 'Learn', component: Learn, frames: LEARN_FRAMES },
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
