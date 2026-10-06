import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import type { AutomationMetrics, MetricsRange, MetricsResponse, MetricValue, RunHistograms } from '@momentum/contract';
import { api } from '../../lib/api';
import { automationLabel, usagePct } from '../../lib/format';
import { useCurrentWorkspace } from '../../lib/workspace';
import { C, F, useTheme, useWide } from '../../ui/theme';
import { H, T } from '../../ui/Text';
import { Pick, Segmented } from '../../ui/parts';
import { ProjectLogo } from '../../ui/ProjectLogo';
import { useCornerRoom } from '../../ui/SettingsButton';
import { STATE_LABEL } from '../../ui/StateBadge';
import { Chart, TimeChart, timeTicks, when, type ChartAxis, type ChartLayer, type ChartSeries } from '../../ui/TimeChart';
import { automationSeries, UsageLegend, UsageMeter, useAutomationColor, useSegments, type Segment } from '../../ui/UsageMeter';

type Unit = 'hour' | 'day';
type Fmt = (v: number) => string;

const RANGES: { value: MetricsRange; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 d' },
  { value: '30d', label: '30 d' },
];

const count: Fmt = (v) => String(Math.round(v));
const ratio: Fmt = (v) => v.toFixed(2);
const pct: Fmt = (v) => usagePct(v);

/** "<1 min", "14 min", "2 h 5 min". */
const minutes: Fmt = (s) => {
  const min = Math.round(s / 60);
  if (min < 1) return s < 1 ? '0' : '<1 min';
  if (min < 60) return `${min} min`;
  return min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`;
};

/** Seconds under a minute, minutes and hours above. */
const duration: Fmt = (s) => (s < 60 ? `${Math.round(s)} s` : minutes(s));

const show = (v: number | null, f: Fmt) => (v === null ? '—' : f(v));

function Panel({ title, children, style }: { title: string; children: ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        style,
      ]}
    >
      <H style={{ fontSize: 15, marginBottom: 4 }}>{title}</H>
      {children}
    </View>
  );
}

/** The account's share of one limit: the latest reading, what used it, and the readings over the range. */
function UsageTile({ label, m, segments, unit }: { label: string; m: MetricValue; segments: Segment[]; unit: Unit }) {
  const [active, setActive] = useState<number | null>(null);
  const point = active === null ? null : m.series[active];
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T style={{ color: C.muted, fontSize: 11.5, flex: 1 }}>{label}</T>
        {point ? <T style={{ color: C.muted, fontSize: 11.5 }}>{when(point.at, unit)}</T> : null}
      </View>
      <T style={{ fontSize: 18, fontFamily: F.head, fontWeight: '700' }}>
        {point ? show(point.value, pct) : m.value === null ? '—' : `${Math.round(m.value)}%`}
      </T>
      <UsageMeter segments={segments} />
      <TimeChart
        at={m.series.map((p) => p.at)}
        unit={unit}
        series={[{ key: label, label, color: C.ink, values: m.series.map((p) => p.value) }]}
        kind="line"
        format={pct}
        max={100}
        height={72}
        active={active}
        onActive={setActive}
      />
    </View>
  );
}

// Narrow enough to leave the automation's name a line of its own on a phone
const COLS = [
  { label: 'Runs', width: 34 },
  { label: 'Failed', width: 40 },
  { label: 'Avg', width: 50 },
  { label: '5 h', width: 38 },
  { label: 'Week', width: 40 },
];

function Cell({ i, children, head }: { i: number; children: string; head?: boolean }) {
  return (
    <T numberOfLines={1} style={{ width: COLS[i]!.width, textAlign: 'right', fontSize: head ? 11.5 : 13, color: head ? C.muted : C.ink }}>
      {children}
    </T>
  );
}

/** Totals over the range per automation; the 5 h and Week columns are points of each limit its runs used. */
function AutomationTable({ automations, range }: { automations: AutomationMetrics[]; range: string }) {
  const color = useAutomationColor();
  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
        <T style={{ flex: 1, color: C.muted, fontSize: 11.5 }}>{`Last ${range}`}</T>
        {COLS.map((c, i) => (
          <Cell key={c.label} i={i} head>
            {c.label}
          </Cell>
        ))}
      </View>
      {automations.map((a) => (
        <View
          key={a.automation}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: 1, borderTopColor: C.line, borderStyle: 'dashed' }}
        >
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color(a.automation) }} />
            <T style={{ color: C.muted, fontSize: 13.5, flexShrink: 1 }}>
              {automationLabel(a.automation)}
              {a.variant ? <T style={{ fontSize: 12 }}>{` · variant ${a.variant}`}</T> : null}
            </T>
          </View>
          <Cell i={0}>{show(a.runs.value, count)}</Cell>
          <Cell i={1}>{show(a.failed.value, count)}</Cell>
          <Cell i={2}>{show(a.avgSeconds.value, minutes)}</Cell>
          <Cell i={3}>{show(a.usage.fiveHour.value, pct)}</Cell>
          <Cell i={4}>{show(a.usage.week.value, pct)}</Cell>
        </View>
      ))}
    </View>
  );
}

// Any metric over the range, on one chart

type UnitKey = 'count' | 'time' | 'points' | 'ratio';

const UNITS: Record<UnitKey, ChartAxis> = {
  count: { format: count, integer: true },
  time: { format: duration },
  points: { format: pct },
  ratio: { format: ratio, max: 1 },
};

/** One metric the chart can show: a single series, or one per automation or state */
type MetricDef = {
  key: string;
  group: string;
  label: string;
  unit: UnitKey;
  kind: 'bars' | 'line';
  series: ChartSeries[];
  /** The figure over the whole range; none for a line per automation */
  figure: number | null;
  /** Split into several series; the bars of a split metric add up to its total */
  split: boolean;
};

const STORE = 'momentum.metrics.chart';
const DEFAULT = ['entities.verification'];

const values = (m: MetricValue) => m.series.map((p) => p.value);

/** Every metric of the response, in the order the picker shows them. */
function useCatalog(m: MetricsResponse): MetricDef[] {
  const color = useAutomationColor();
  const autos = m.agents.automations;
  const single = (group: string, key: string, label: string, unit: UnitKey, kind: 'bars' | 'line', v: MetricValue): MetricDef => ({
    key,
    group,
    label,
    unit,
    kind,
    series: [{ key, label, color: C.ink, values: values(v) }],
    figure: v.value,
    split: false,
  });
  const byAutomation = (key: string, label: string, unit: UnitKey, kind: 'bars' | 'line', pick: (a: AutomationMetrics) => MetricValue): MetricDef => ({
    key,
    group: 'Automations',
    label,
    unit,
    kind,
    series: automationSeries(color, autos, (a) => values(pick(a)), kind === 'bars'),
    figure: kind === 'bars' ? autos.reduce((s, a) => s + (pick(a).value ?? 0), 0) : null,
    split: true,
  });
  const byState = <K extends keyof typeof STATE_LABEL>(key: string, label: string, states: Record<K, MetricValue>, colors: Record<K, string>): MetricDef => {
    const keys = Object.keys(states) as K[];
    return {
      key,
      group: 'Entities',
      label,
      unit: 'count',
      kind: 'bars',
      series: keys.map((k) => ({ key: k, label: STATE_LABEL[k], color: colors[k], values: values(states[k]) })),
      figure: keys.reduce((s, k) => s + (states[k].value ?? 0), 0),
      split: true,
    };
  };
  return [
    byState('entities.verification', 'By verification', m.entities.verification, { unverified: C.stateUnverified, verified: C.stateVerified }),
    byState('entities.sync', 'By sync', m.entities.sync, { synced: C.stateSynced, entity_ahead: C.stateEntityAhead, artifact_ahead: C.stateArtifactAhead, updating: C.stateUpdating }),
    single('Usage', 'usage.fiveHour', 'Account · 5-hour limit', 'points', 'line', m.usage.fiveHour),
    single('Usage', 'usage.week', 'Account · weekly limit', 'points', 'line', m.usage.week),
    byAutomation('automations.fiveHour', 'Usage · 5-hour limit', 'points', 'bars', (a) => a.usage.fiveHour),
    byAutomation('automations.week', 'Usage · weekly limit', 'points', 'bars', (a) => a.usage.week),
    byAutomation('automations.runs', 'Runs', 'count', 'bars', (a) => a.runs),
    byAutomation('automations.failed', 'Failed', 'count', 'bars', (a) => a.failed),
    byAutomation('automations.avgSeconds', 'Avg time', 'time', 'line', (a) => a.avgSeconds),
    single('Attention', 'attention.timePerItem', 'Time per item', 'time', 'line', m.attention.timePerItemSeconds),
    single('Attention', 'attention.approved', 'Approved', 'count', 'bars', m.attention.approved),
    single('Attention', 'attention.rejected', 'Rejected', 'count', 'bars', m.attention.rejected),
    single('Attention', 'attention.sentBack', 'Sent back', 'count', 'bars', m.attention.sentBack),
    single('Attention', 'attention.patterns', 'Patterns automated', 'count', 'line', m.attention.patternsAutomated),
    single('Understanding', 'understanding.consistency', 'Consistency', 'ratio', 'line', m.understanding.consistency),
    single('Understanding', 'understanding.openIssues', 'Open issues', 'count', 'line', m.understanding.openIssues),
    single('Agents', 'agents.misalignments', 'Misalignments', 'count', 'bars', m.agents.misalignments),
    single('Agents', 'agents.recurring', 'Recurring issues', 'count', 'bars', m.agents.recurringIssues),
    single('Implementation', 'implementation.outstanding', 'Outstanding issues', 'count', 'line', m.implementation.outstandingIssues),
    single('Implementation', 'implementation.bugs', 'Bugs', 'count', 'line', m.implementation.bugs),
    single('Implementation', 'implementation.defects', 'Defects', 'count', 'line', m.implementation.defects),
  ];
}

/** Adds or removes a metric; past two units, the oldest metrics of another unit make way for the new one. */
function toggle(selected: string[], key: string, unitOf: (k: string) => UnitKey | undefined): string[] {
  if (selected.includes(key)) return selected.filter((k) => k !== key);
  const unit = unitOf(key);
  let next = [...selected, key];
  while (new Set(next.map(unitOf)).size > 2) {
    const drop = next.find((k) => unitOf(k) !== unit)!;
    next = next.filter((k) => k !== drop);
  }
  return next;
}

/** The metrics picked for the chart, kept on the device. */
function useSelection(): [string[], (f: (s: string[]) => string[]) => void] {
  const [selected, setSelected] = useState<string[] | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(STORE)
      .then((v) => setSelected(v ? (JSON.parse(v) as string[]) : DEFAULT))
      .catch(() => setSelected(DEFAULT));
  }, []);
  const update = useCallback((f: (s: string[]) => string[]) => {
    setSelected((s) => {
      const next = f(s ?? DEFAULT);
      void AsyncStorage.setItem(STORE, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return [selected ?? DEFAULT, update];
}

function Swatch({ color, line }: { color: string; line?: boolean }) {
  return <View style={{ width: 10, height: line ? 3 : 10, borderRadius: line ? 1.5 : 2, backgroundColor: color }} />;
}

/** One charted metric: its colours, name and figure, or the hovered bucket's value and what it is made of. */
function Readout({ d, active, axis }: { d: MetricDef; active: number | null; axis: 'left' | 'right' | null }) {
  const f = UNITS[d.unit].format;
  const at = (s: ChartSeries) => (active === null ? null : (s.values[active] ?? null));
  const lines = d.split && d.kind === 'line';
  const figure =
    active === null || lines ? d.figure : d.series.reduce<number | null>((sum, s) => (at(s) === null ? sum : (sum ?? 0) + at(s)!), null);
  const parts = active === null ? [] : d.series.filter((s) => (at(s) ?? 0) > 0).map((s) => `${s.label} ${f(at(s)!)}`);
  return (
    <View style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.line, borderStyle: 'dashed' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {d.series.slice(0, 7).map((s) => (
            <Swatch key={s.key} color={s.color} line={d.kind === 'line'} />
          ))}
        </View>
        <T style={{ color: C.muted, fontSize: 13.5, flex: 1 }}>
          {d.group === 'Usage' || d.group === 'Automations' ? d.label : `${d.group} · ${d.label}`}
          {axis ? <T style={{ fontSize: 11.5 }}>{` · ${axis} axis`}</T> : null}
        </T>
        {lines ? null : <T style={{ fontSize: 15, fontWeight: '700' }}>{show(figure, f)}</T>}
      </View>
      {d.split ? (
        <T style={{ color: C.muted, fontSize: 12, minHeight: 16 }}>
          {active === null ? d.series.map((s) => s.label).join(' · ') : parts.join(' · ') || 'None'}
        </T>
      ) : null}
    </View>
  );
}

function Picker({ catalog, selected, onToggle }: { catalog: MetricDef[]; selected: string[]; onToggle: (key: string) => void }) {
  const groups = [...new Set(catalog.map((d) => d.group))];
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      {groups.map((g) => (
        <View key={g} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <T style={{ color: C.muted, fontSize: 11.5, width: 96, paddingTop: 5 }}>{g}</T>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {catalog
              .filter((d) => d.group === g)
              .map((d) => {
                const on = selected.includes(d.key);
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => onToggle(d.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? C.ink : C.line,
                      backgroundColor: on ? C.ink : undefined,
                    }}
                  >
                    <T style={{ fontSize: 12, color: on ? C.surface : C.muted }}>{d.label}</T>
                  </Pressable>
                );
              })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** The picked metrics over the range, against one axis per unit, at most two. */
function MetricsChart({ m, unit }: { m: MetricsResponse; unit: Unit }) {
  const catalog = useCatalog(m);
  const [selected, setSelected] = useSelection();
  const [active, setActive] = useState<number | null>(null);
  const byKey = new Map(catalog.map((d) => [d.key, d]));
  const picked = selected.flatMap((k) => byKey.get(k) ?? []);
  const units = [...new Set(picked.map((d) => d.unit))];
  // Metrics of a single series each take the next colour, so no two of them share one
  const colors = [C.ink, C.accent, C.ok, C.no, C.warn, C.faint];
  let next = 0;
  const shown = picked.map((d) => (d.split ? d : { ...d, series: d.series.map((s) => ({ ...s, color: colors[next++ % colors.length]! })) }));
  const layers: ChartLayer[] = shown.map((d) => ({
    key: d.key,
    label: d.label,
    kind: d.kind,
    axis: units.indexOf(d.unit) === 1 ? 1 : 0,
    series: d.series,
  }));
  const axes = (units.length ? units : (['count'] as UnitKey[])).map((u) => UNITS[u]) as [ChartAxis] | [ChartAxis, ChartAxis];
  const at = m.usage.week.series.map((p) => p.at);
  return (
    <Panel title="Over time">
      <T style={{ color: C.muted, fontSize: 12, minHeight: 16, textAlign: 'right' }}>{active === null ? '' : when(at[active]!, unit)}</T>
      <Chart
        labels={at.map((iso) => when(iso, unit))}
        ticks={timeTicks(at, unit)}
        layers={layers}
        axes={axes}
        height={180}
        active={active}
        onActive={setActive}
      />
      <View style={{ marginTop: 6 }}>
        {shown.length ? (
          shown.map((d) => (
            <Readout key={d.key} d={d} active={active} axis={units.length > 1 ? (units.indexOf(d.unit) ? 'right' : 'left') : null} />
          ))
        ) : (
          <T style={{ color: C.muted, fontSize: 13.5 }}>Pick metrics to chart</T>
        )}
      </View>
      <Picker catalog={catalog} selected={selected} onToggle={(k) => setSelected((s) => toggle(s, k, (x) => byKey.get(x)?.unit))} />
    </Panel>
  );
}

// How single runs spread over one parameter, per automation

type Param = keyof RunHistograms;

const PARAMS: { value: Param; label: string; format: Fmt }[] = [
  { value: 'fiveHour', label: 'Usage · 5-hour', format: pct },
  { value: 'week', label: 'Usage · weekly', format: pct },
  { value: 'seconds', label: 'Duration', format: duration },
  { value: 'messages', label: 'Messages', format: count },
];

function RunHistogram({ h, range }: { h: RunHistograms; range: string }) {
  const color = useAutomationColor();
  const [param, setParam] = useState<Param>('week');
  const [active, setActive] = useState<number | null>(null);
  const { edges, automations } = h[param];
  const f = PARAMS.find((p) => p.value === param)!.format;
  const n = edges.length - 1;
  const bins = Array.from({ length: n }, (_, i) => `${f(edges[i]!)}–${f(edges[i + 1]!)}`);
  const series = automationSeries(color, automations, (a) => a.counts, true);
  const runs = series.reduce((s, x) => s + x.values.reduce<number>((a, v, i) => a + (active === null || i === active ? (v ?? 0) : 0), 0), 0);
  const parts = active === null ? [] : series.filter((s) => (s.values[active] ?? 0) > 0).map((s) => `${s.label} ${s.values[active]}`);
  return (
    <Panel title="Runs by parameter">
      <Segmented value={param} options={PARAMS} onChange={(p) => (setActive(null), setParam(p))} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <T style={{ color: C.muted, fontSize: 13.5, flex: 1 }}>{active === null ? `Runs ended in the last ${range}` : bins[active]}</T>
        <T style={{ fontSize: 15, fontWeight: '700' }}>{count(runs)}</T>
      </View>
      <Chart
        labels={bins}
        ticks={[0, Math.round(n / 2), n].filter((i, k, a) => a.indexOf(i) === k).map((i) => ({ at: i, text: f(edges[i]!) }))}
        layers={[{ key: param, label: 'Runs', kind: 'bars', axis: 0, series }]}
        axes={[{ format: count, integer: true }]}
        height={140}
        active={active}
        onActive={setActive}
      />
      <T style={{ color: C.muted, fontSize: 12, minHeight: 16, marginTop: 2 }}>
        {active === null ? series.map((s) => s.label).join(' · ') : parts.join(' · ') || 'None'}
      </T>
    </Panel>
  );
}

export default function Metrics() {
  useTheme();
  const wide = useWide();
  const corner = useCornerRoom();
  const [ws, setWs, names] = useCurrentWorkspace();
  const [range, setRange] = useState<MetricsRange>('30d');
  const { data: m } = useQuery({
    queryKey: ['metrics', ws, range],
    queryFn: () => api.metrics(ws as string, range),
    enabled: !!ws,
    placeholderData: (prev) => prev,
  });

  const autos = m?.agents.automations ?? [];
  const five = useSegments(autos, 'fiveHour', m?.usage.fiveHour.value ?? null);
  const week = useSegments(autos, 'week', m?.usage.week.value ?? null);
  const legend = [...week, ...five.filter((f) => !week.some((w) => w.key === f.key))];
  const unit: Unit = m?.range === '24h' ? 'hour' : 'day';
  const label = RANGES.find((r) => r.value === (m?.range ?? range))!.label;

  return (
    <ScrollView
      contentContainerStyle={
        wide
          ? { maxWidth: 860, paddingVertical: 28, paddingHorizontal: 40 }
          : { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
      }
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: corner, zIndex: 10 }}
      >
        <Pick value={ws} options={names} onChange={setWs} icon={(o, size) => <ProjectLogo name={o} size={size} />} />
        <Segmented value={range} options={RANGES} onChange={setRange} />
      </View>
      {m ? (
        <View style={{ gap: wide ? 16 : 12 }}>
          <Panel title="Usage">
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10, marginTop: 4 }}>
              <UsageTile label="Rolling 5 hours" m={m.usage.fiveHour} segments={five} unit={unit} />
              <UsageTile label="Rolling week" m={m.usage.week} segments={week} unit={unit} />
            </View>
            <UsageLegend segments={legend} />
          </Panel>
          <MetricsChart m={m} unit={unit} />
          <RunHistogram h={m.agents.runHistograms} range={label} />
          <Panel title="Automations">
            {autos.length ? (
              <AutomationTable automations={autos} range={label} />
            ) : (
              <T style={{ color: C.muted, fontSize: 13.5 }}>{`No runs in the last ${label}`}</T>
            )}
          </Panel>
        </View>
      ) : null}
    </ScrollView>
  );
}
