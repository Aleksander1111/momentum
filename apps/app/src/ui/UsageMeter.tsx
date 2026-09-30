import { View } from 'react-native';
import type { AutomationMetrics, AutomationName } from '@momentum/contract';
import { automationLabel } from '../lib/format';
import { C, useTheme, type Scheme } from './theme';
import { T } from './Text';

/**
 * Categorical slots of the dataviz reference palette, validated against the app surfaces (#FFFFFF, #1E262A).
 * Colour follows the automation, never its rank; the automations without a slot fold into Other.
 */
const SLOTS: Record<Scheme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
};

const SLOTTED: AutomationName[] = ['summarization', 'graph-build', 'implementation', 'chat', 'exploration', 'preparation', 'validation'];

export type Segment = { key: string; label: string; color: string; value: number };

/** The colour of an automation in the usage charts; Other for those without a slot. */
export function useAutomationColor(): (a: AutomationName) => string {
  const { scheme } = useTheme();
  return (a) => {
    const i = SLOTTED.indexOf(a);
    return i < 0 ? C.muted : SLOTS[scheme][i]!;
  };
}

/** Segments of one usage window in slot order, with Other taking whatever the slotted automations do not account for. */
export function useSegments(automations: AutomationMetrics[], window: 'fiveHour' | 'week', total: number | null): Segment[] {
  const color = useAutomationColor();
  const slotted = SLOTTED.flatMap((name) => {
    const a = automations.find((x) => x.automation === name);
    const value = a?.usage[window] ?? 0;
    return value > 0 ? [{ key: name, label: automationLabel(name), color: color(name), value }] : [];
  });
  const other = (total ?? 0) - slotted.reduce((s, x) => s + x.value, 0);
  return other > 0.05 ? [...slotted, { key: 'other', label: 'Other', color: C.muted, value: other }] : slotted;
}

/** A stacked bar of the rolling limit: each automation's share, the rest of the track unused. */
export function UsageMeter({ segments }: { segments: Segment[] }) {
  let left = 100;
  return (
    <View
      style={{ flexDirection: 'row', height: 10, borderRadius: 4, overflow: 'hidden', backgroundColor: C.line, marginTop: 6 }}
      accessibilityLabel={segments.map((s) => `${s.label} ${s.value.toFixed(1)}%`).join(', ') || 'No usage'}
    >
      {segments.map((s) => {
        const w = Math.min(s.value, left);
        left -= w;
        return w > 0 ? (
          <View key={s.key} style={{ width: `${w}%`, backgroundColor: s.color, borderRightWidth: 2, borderRightColor: C.card }} />
        ) : null;
      })}
    </View>
  );
}

/** Swatch and name of each segment shown in the meters. */
export function UsageLegend({ segments }: { segments: Segment[] }) {
  if (!segments.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 10 }}>
      {segments.map((s) => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
          <T style={{ color: C.muted, fontSize: 12 }}>{s.label}</T>
        </View>
      ))}
    </View>
  );
}
