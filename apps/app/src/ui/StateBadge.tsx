import { View } from 'react-native';
import type { Sync, Verification } from '@momentum/contract';
import { C, F } from './theme';
import { T, H } from './Text';

type State = Verification | Sync;

const STATE: Record<State, { glyph: string; colour: string; label: string }> = {
  unverified: { glyph: '?', colour: C.warn, label: 'Unverified' },
  verified: { glyph: '✓', colour: C.ok, label: 'Verified' },
  synced: { glyph: '=', colour: C.muted, label: 'Synced' },
  entity_ahead: { glyph: '→', colour: C.accent, label: 'Entity ahead' },
  artifact_ahead: { glyph: '←', colour: C.warn, label: 'Artifact ahead' },
  updating: { glyph: '↻', colour: C.accent, label: 'Updating' },
};

export function StateBadge({ state, label }: { state: State; label?: boolean }) {
  const s = STATE[state];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: s.colour,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={{ color: C.white, fontSize: 11, lineHeight: 13, fontFamily: F.body }}>{s.glyph}</T>
      </View>
      {label ? <H style={{ color: s.colour, fontSize: 14 }}>{s.label}</H> : null}
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
