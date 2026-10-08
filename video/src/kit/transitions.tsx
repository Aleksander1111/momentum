// Transitions between scenes, drawn with CSS alone: the scene leaving and the one arriving overlap for the transition
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import type { FC } from 'react';
import { AbsoluteFill, Easing } from 'remotion';

type None = Record<string, never>;
const ease = Easing.inOut(Easing.cubic);

/** The leaving scene rushes towards the viewer and blurs away; the next one settles in from behind */
const ZoomThrough: FC<TransitionPresentationComponentProps<None>> = ({ children, presentationDirection, presentationProgress }) => {
  const t = ease(presentationProgress);
  const leaving = presentationDirection === 'exiting';
  const scale = leaving ? 1 + 0.35 * t : 0.82 + 0.18 * t;
  const blur = leaving ? 18 * t : 14 * (1 - t);
  const opacity = leaving ? 1 - t : Math.min(1, t * 1.6);
  return <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>{children}</AbsoluteFill>;
};
export const zoomThrough = (): TransitionPresentation<None> => ({ component: ZoomThrough, props: {} });

/** The next scene pushes the leaving one aside, both moving with a little motion blur */
const Push: FC<TransitionPresentationComponentProps<{ from: 'right' | 'bottom' }>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const t = ease(presentationProgress);
  const leaving = presentationDirection === 'exiting';
  const offset = leaving ? -t * 100 : (1 - t) * 100;
  const axis = passedProps.from === 'right' ? 'X' : 'Y';
  const blur = 10 * Math.sin(Math.PI * t);
  return (
    <AbsoluteFill style={{ transform: `translate${axis}(${offset * (leaving ? 0.35 : 1)}%)`, filter: `blur(${blur}px)`, opacity: leaving ? 1 - 0.6 * t : 1 }}>
      {children}
    </AbsoluteFill>
  );
};
export const push = (from: 'right' | 'bottom' = 'right'): TransitionPresentation<{ from: 'right' | 'bottom' }> => ({ component: Push, props: { from } });

/** The next scene opens as a growing circle from a point of the frame */
const Iris: FC<TransitionPresentationComponentProps<{ x: number; y: number }>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const t = ease(presentationProgress);
  if (presentationDirection === 'exiting') return <AbsoluteFill style={{ transform: `scale(${1 + 0.08 * t})`, filter: `blur(${6 * t}px)` }}>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ clipPath: `circle(${t * 2300}px at ${passedProps.x}px ${passedProps.y}px)` }}>
      {children}
    </AbsoluteFill>
  );
};
export const iris = (x: number, y: number): TransitionPresentation<{ x: number; y: number }> => ({ component: Iris, props: { x, y } });
