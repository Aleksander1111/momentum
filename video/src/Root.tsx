import { Composition } from 'remotion';
import { Harness } from './Harness.tsx';
import { FPS, TOTAL_FRAMES } from './scenes.ts';

export function Root() {
  return <Composition id="Harness" component={Harness} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />;
}
