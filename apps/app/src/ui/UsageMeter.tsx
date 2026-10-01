import { View } from 'react-native';
import type { AutomationMetrics, AutomationName } from '@momentum/contract';
import { automationLabel } from '../lib/format';
import { C, useTheme, type Scheme } from './theme';
import type { ChartSeries } from './TimeChart';
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

/**
 * Segments of one limit in slot order: each automation's share of the rolling window, Other for the automations without a
 * slot, and Outside runs for the rest of the account's reading, used outside Momentum or rolled into the window before.
 */
export function useSegments(automations: AutomationMetrics[], window: 'fiveHour' | 'week', total: number | null): Segment[] {
  const color = useAutomationColor();
  const used = (a: AutomationMetrics | undefined) => a?.rolling[window] ?? 0;
  const slotted = SLOTTED.flatMap((name) => {
    const value = used(automations.find((x) => x.automation === name));
    return value > 0 ? [{ key: name, label: automationLabel(name), color: color(name), value }] : [];
  });
  const other = automations.filter((a) => !SLOTTED.includes(a.automation)).reduce((s, a) => s + used(a), 0);
  const outside = (total ?? 0) - slotted.reduce((s, x) => s + x.value, 0) - other;
  return [
    ...slotted,
    ...(other > 0.05 ? [{ key: 'other', label: 'Other', color: C.muted, value: other }] : []),
    ...(outside > 0.05 ? [{ key: 'outside', label: 'Outside runs', color: C.faint, value: outside }] : []),
  ];
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

/**
 * One chart series per automation in slot order, from `pick`; with `fold`, the automations without a slot are summed
 * into one Other series, as in the meters.
 */
export function automationSeries<A extends { automation: AutomationName }>(
  color: (a: AutomationName) => string,
  automations: A[],
  pick: (a: A) => (number | null)[],
  fold: boolean,
): ChartSeries[] {
  const slotted = SLOTTED.flatMap((name) => {
    const a = automations.find((x) => x.automation === name);
    return a ? [{ key: name, label: automationLabel(name), color: color(name), values: pick(a) }] : [];
  });
  const rest = automations.filter((a) => !SLOTTED.includes(a.automation));
  if (!fold) return [...slotted, ...rest.map((a) => ({ key: a.automation, label: automationLabel(a.automation), color: C.muted, values: pick(a) }))];
  if (!rest.length) return slotted;
  const values = pick(rest[0]!).map((_, i) => rest.reduce((s, a) => s + (pick(a)[i] ?? 0), 0));
  return [...slotted, { key: 'other', label: 'Other', color: C.muted, values }];
}
