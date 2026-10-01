import { useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Sync, Verification } from '@momentum/contract';
import { C } from './theme';
import { H, T } from './Text';

export type State = Verification | Sync;

/**
 * Stroked glyphs on a 24 grid. Sync arrows follow the layers: the entity sits above its artifact, so entity ahead
 * points down (the change flows into the artifact) and artifact ahead points up (into the entity).
 * Colours are palette keys, read while rendering so they follow the scheme.
 */
const STATE: Record<State, { path: string; colour: keyof typeof C; label: string }> = {
  unverified: {
    path: 'M8 8a3.5 3 0 0 1 3.5-3h1a3.5 3 0 0 1 3.5 3 3 3 0 0 1-2 3 3 4 0 0 0-2 4M12 19v.01',
    colour: 'stateUnverified',
    label: 'Unverified',
  },
  verified: { path: 'M5 12l5 5L20 7', colour: 'stateVerified', label: 'Verified' },
  synced: {
    path: 'M9 15l6-6M11 6l.46-.54a5 5 0 0 1 7.08 7.08l-.54.46M13 18l-.4.53a5.07 5.07 0 0 1-7.12 0 4.97 4.97 0 0 1 0-7.07l.52-.46',
    colour: 'stateSynced',
    label: 'Synced',
  },
  entity_ahead: { path: 'M12 20V10M12 20l4-4M12 20l-4-4M4 4h16', colour: 'stateEntityAhead', label: 'Entity ahead' },
  artifact_ahead: { path: 'M12 4v10M12 4l4 4M12 4L8 8M4 20h16', colour: 'stateArtifactAhead', label: 'Artifact ahead' },
  updating: {
    path: 'M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4',
    colour: 'stateUpdating',
    label: 'Updating',
  },
};

export const STATE_LABEL: Record<State, string> = Object.fromEntries(
  Object.entries(STATE).map(([k, v]) => [k, v.label]),
) as Record<State, string>;

export function stateColour(state: State): string {
  return C[STATE[state].colour];
}

export function StateIcon({ state, size = 16 }: { state: State; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STATE[state].path}
        stroke={stateColour(state)}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const BUBBLE: Record<'top' | 'left', ViewStyle> = {
  top: { bottom: '100%', left: -100, right: -100, marginBottom: 6, alignItems: 'center' },
  left: { right: '100%', top: -20, bottom: -20, marginRight: 6, justifyContent: 'center' },
};

/**
 * Names its child in a bubble on hover, or on long-press when `touch` is set. Without `touch` it never takes the
 * press, so a row it sits in still opens; `left` keeps the bubble inside a clipped list row.
 */
export function Tip({
  text,
  side = 'top',
  touch,
  children,
}: {
  text: string;
  side?: 'top' | 'left';
  touch?: boolean;
  children: ReactNode;
}) {
  const [on, setOn] = useState(false);
  const show = () => setOn(true);
  const hide = () => setOn(false);
  const bubble = on ? (
    <View pointerEvents="none" style={[{ position: 'absolute', zIndex: 10 }, BUBBLE[side]]}>
      <View style={{ backgroundColor: C.ink, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
        <T style={{ color: C.surface, fontSize: 11 }} numberOfLines={1}>
          {text}
        </T>
      </View>
    </View>
  ) : null;
  return touch ? (
    <Pressable accessibilityLabel={text} onHoverIn={show} onHoverOut={hide} onLongPress={show} onPressOut={hide}>
      {children}
      {bubble}
    </Pressable>
  ) : (
    <View accessibilityLabel={text} onPointerEnter={show} onPointerLeave={hide}>
      {children}
      {bubble}
    </View>
  );
}

export function StateBadge({ state, label }: { state: State; label?: boolean }) {
  if (!label) {
    return (
      <Tip text={STATE[state].label} side="left">
        <StateIcon state={state} />
      </Tip>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <StateIcon state={state} />
      <H style={{ color: stateColour(state), fontSize: 14 }}>{STATE[state].label}</H>
    </View>
  );
}

export function States({
  verification,
  sync,
  labels,
}: {
  verification: Verification | null;
  sync: Sync | null;
  labels?: boolean;
}) {
  if (!verification && !sync) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 'auto' }}>
      {verification ? <StateBadge state={verification} label={labels} /> : null}
      {sync ? <StateBadge state={sync} label={labels} /> : null}
    </View>
  );
}
