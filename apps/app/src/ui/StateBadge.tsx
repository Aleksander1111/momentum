import { View } from 'react-native';
import type { Sync, Verification } from '@momentum/contract';
import { C, F } from './theme';
import { T, H } from './Text';

type State = Verification | Sync;

/** Colours are palette keys, read while rendering so they follow the scheme. */
const STATE: Record<State, { glyph: string; colour: keyof typeof C; label: string }> = {
  unverified: { glyph: '?', colour: 'warn', label: 'Unverified' },
  verified: { glyph: '✓', colour: 'ok', label: 'Verified' },
  synced: { glyph: '=', colour: 'muted', label: 'Synced' },
  entity_ahead: { glyph: '→', colour: 'accent', label: 'Entity ahead' },
  artifact_ahead: { glyph: '←', colour: 'warn', label: 'Artifact ahead' },
  updating: { glyph: '↻', colour: 'accent', label: 'Updating' },
};

export const STATE_LABEL: Record<State, string> = Object.fromEntries(
  Object.entries(STATE).map(([k, v]) => [k, v.label]),
) as Record<State, string>;

export function StateBadge({ state, label }: { state: State; label?: boolean }) {
  const s = STATE[state];
  const colour = C[s.colour];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: colour,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={{ color: C.surface, fontSize: 11, lineHeight: 13, fontFamily: F.body }}>{s.glyph}</T>
      </View>
      {label ? <H style={{ color: colour, fontSize: 14 }}>{s.label}</H> : null}
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
