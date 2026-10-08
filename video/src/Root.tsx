import { Composition } from 'remotion';
import { FPS } from './kit/motion.ts';
import { Layers, LAYERS_FRAMES } from './scenes/Layers.tsx';

export function Root() {
  return <Composition id="Layers" component={Layers} durationInFrames={LAYERS_FRAMES} fps={FPS} width={1920} height={1080} />;
}
