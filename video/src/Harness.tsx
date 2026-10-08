import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { FADE_FRAMES, SCENE_FRAMES, SCENES, type Scene } from './scenes.ts';

// The deck's ink and body font (docs/harness-diagram.build.js)
const INK = '#2F3E46';
const BODY = 'Calibri, "Segoe UI", sans-serif';

/** The slide above, slowly drawing closer; its caption below, never over the slide */
function Slide({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, SCENE_FRAMES], [1, 1.035]);
  const rise = interpolate(frame, [FADE_FRAMES, FADE_FRAMES + 15], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shown = interpolate(frame, [FADE_FRAMES, FADE_FRAMES + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#FFFFFF', alignItems: 'center' }}>
      <div style={{ marginTop: 28, width: 1632, height: 918, overflow: 'hidden' }}>
        <Img src={staticFile(`slides/${scene.slide}`)} style={{ width: '100%', height: '100%', transform: `scale(${zoom})`, transformOrigin: '50% 45%' }} />
      </div>
      <div style={{ marginTop: 26, width: 1500, textAlign: 'center', fontFamily: BODY, fontSize: 34, color: INK, lineHeight: 1.25, opacity: shown, transform: `translateY(${rise}px)` }}>
        {scene.caption}
      </div>
    </AbsoluteFill>
  );
}

export function Harness() {
  return (
    <TransitionSeries>
      {SCENES.flatMap((scene, i) => [
        ...(i > 0 ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />] : []),
        <TransitionSeries.Sequence key={scene.slide} durationInFrames={SCENE_FRAMES}>
          <Slide scene={scene} />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
}
