import { Pressable, View } from 'react-native';
import type { FeedItem, Severity } from '@momentum/contract';
import { C, F } from './theme';
import { T } from './Text';
import { EntityRef } from './EntityRef';

type Issue = NonNullable<FeedItem['issue']>;

const SEVERITY: Record<Severity, { label: string; colour: () => string }> = {
  high: { label: 'High', colour: () => C.no },
  medium: { label: 'Medium', colour: () => C.warn },
  low: { label: 'Low', colour: () => C.muted },
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

function Chip({ label, fill, ink }: { label: string; fill: string; ink: string }) {
  return (
    <View style={{ backgroundColor: fill, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
      <T style={{ color: ink, fontSize: 11.5, fontWeight: '700' }}>{label}</T>
    </View>
  );
}

/** Severity, category and the entities an issue concerns, the one at fault first */
export function IssueHead({ issue, workspace }: { issue: Issue; workspace: string }) {
  return (
    <View style={{ marginTop: 4, marginBottom: 6, gap: 10 }}>
      {issue.severity || issue.category ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {issue.severity ? (
            <Chip label={SEVERITY[issue.severity].label} fill={SEVERITY[issue.severity].colour()} ink={C.surface} />
          ) : null}
          {issue.category ? <Chip label={capital(issue.category)} fill={C.washNo} ink={C.no} /> : null}
        </View>
      ) : null}
      {issue.concerns.length ? (
        <View>
          <T style={{ color: C.muted, fontSize: 12.5 }}>Concerns</T>
          <View style={{ gap: 3, marginTop: 3, alignItems: 'flex-start' }}>
            {issue.concerns.map((p, i) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
                <EntityRef workspace={workspace} path={p} title={issue.titles[p]} size={12.5} />
                {i === 0 ? <T style={{ color: C.no, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 }}>AT FAULT</T> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The options to resolve an issue; a tap picks one, the recommended one is marked */
export function IssueOptions({ issue, picked, onPick }: { issue: Issue; picked: number | null; onPick: (i: number) => void }) {
  return (
    <View style={{ marginTop: 8 }}>
      <T style={{ fontFamily: F.head, fontWeight: '700', fontSize: 15, marginBottom: 8 }}>Resolve</T>
      {issue.options.map((o, i) => {
        const on = picked === i;
        return (
          <Pressable
            key={i}
            onPress={() => onPick(i)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              flexDirection: 'row',
              gap: 10,
              borderWidth: 1,
              borderColor: on ? C.ok : C.line,
              backgroundColor: on ? C.washOk : C.surface,
              borderRadius: 12,
              paddingVertical: 9,
              paddingHorizontal: 12,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                marginTop: 2,
                borderWidth: on ? 5 : 2,
                borderColor: on ? C.ok : C.line,
              }}
            />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', fontSize: 14.5 }}>
                {o.label}
                {issue.recommended === i ? (
                  <T style={{ color: C.ok, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 }}>{'  RECOMMENDED'}</T>
                ) : null}
              </T>
              <T style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{o.change}</T>
            </View>
          </Pressable>
        );
      })}
      <T style={{ color: C.muted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 2 }}>
        {picked === null ? 'tap to pick an option' : 'swipe right to resolve · left for your own'}
      </T>
    </View>
  );
}
