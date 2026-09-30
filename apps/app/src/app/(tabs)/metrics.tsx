import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { AutomationMetrics, MetricsRange, MetricValue } from '@momentum/contract';
import { api } from '../../lib/api';
import { automationLabel, usagePct } from '../../lib/format';
import { useCurrentWorkspace } from '../../lib/workspace';
import { C, F, useTheme, useWide } from '../../ui/theme';
import { H, T } from '../../ui/Text';
import { Pick } from '../../ui/parts';
import { TimeChart, when, type ChartSeries } from '../../ui/TimeChart';
import { UsageLegend, UsageMeter, useAutomationColor, useAutomationSeries, useSegments, type Segment } from '../../ui/UsageMeter';

type Unit = 'hour' | 'day';
type Fmt = (v: number) => string;

const RANGES: { value: MetricsRange; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 d' },
  { value: '30d', label: '30 d' },
];

const count: Fmt = (v) => String(Math.round(v));
const seconds: Fmt = (v) => `${Math.round(v)} s`;
const ratio: Fmt = (v) => v.toFixed(2);
const pct: Fmt = (v) => usagePct(v);

/** "<1 min", "14 min", "2 h 5 min". */
const minutes: Fmt = (s) => {
  const min = Math.round(s / 60);
  if (min < 1) return s < 1 ? '0' : '<1 min';
  if (min < 60) return `${min} min`;
  return min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`;
};

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

/** Label and figure; while a bucket is hovered or touched, the figure gives way to that bucket's value. */
function Head({ label, figure, readout }: { label: string; figure: string; readout: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <T style={{ color: C.muted, fontSize: 13.5, flex: 1 }}>{label}</T>
      {readout ? <T style={{ color: C.muted, fontSize: 12 }}>{readout}</T> : null}
      <T style={{ fontSize: 15, fontWeight: '700' }}>{figure}</T>
    </View>
  );
}

function Block({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 4, borderTopWidth: first ? 0 : 1, borderTopColor: C.line, borderStyle: 'dashed' }}>
      {children}
    </View>
  );
}

/** One metric over the range: its figure and a chart of its points. */
function Stat({
  label,
  m,
  format,
  unit,
  kind = 'bars',
  color = C.muted,
  max,
  first,
}: {
  label: string;
  m: MetricValue;
  format: Fmt;
  unit: Unit;
  kind?: 'bars' | 'line';
  color?: string;
  max?: number;
  first?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const point = active === null ? null : m.series[active];
  return (
    <Block first={first}>
      <Head
        label={label}
        figure={show(point ? point.value : m.value, format)}
        readout={point ? when(point.at, unit) : null}
      />
      <TimeChart
        at={m.series.map((p) => p.at)}
        unit={unit}
        series={[{ key: label, label, color, values: m.series.map((p) => p.value) }]}
        kind={kind}
        format={format}
        integer={format === count}
        max={max}
        active={active}
        onActive={setActive}
      />
    </Block>
  );
}

/** One measure of every automation over the range: stacked bars, or a line each for averages. */
function AutomationStat({
  label,
  automations,
  pick,
  format,
  unit,
  kind,
  first,
}: {
  label: string;
  automations: AutomationMetrics[];
  pick: (a: AutomationMetrics) => MetricValue;
  format: Fmt;
  unit: Unit;
  kind: 'bars' | 'line';
  first?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const series: ChartSeries[] = useAutomationSeries(automations, (a) => pick(a).series.map((p) => p.value), kind === 'bars');
  const at = automations[0] ? pick(automations[0]).series.map((p) => p.at) : [];
  const figure =
    kind === 'bars'
      ? format(automations.reduce((s, a) => s + (pick(a).value ?? 0), 0))
      : '';
  const at_ = active === null ? null : at[active];
  const breakdown =
    active === null
      ? []
      : series.filter((s) => (s.values[active] ?? 0) > 0).map((s) => `${s.label} ${format(s.values[active]!)}`);
  const sum = active === null ? 0 : series.reduce((s, x) => s + (x.values[active] ?? 0), 0);
  return (
    <Block first={first}>
      <Head
        label={label}
        figure={at_ ? (kind === 'bars' ? format(sum) : '') : figure}
        readout={at_ ? when(at_, unit) : null}
      />
      <TimeChart
        at={at}
        unit={unit}
        series={series}
        kind={kind}
        format={format}
        integer={format === count}
        active={active}
        onActive={setActive}
      />
      <T style={{ color: C.muted, fontSize: 12, minHeight: 16, marginTop: 2 }}>
        {active === null ? '' : breakdown.join(' · ') || 'None'}
      </T>
    </Block>
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

const COLS = [
  { label: 'Runs', width: 40 },
  { label: 'Failed', width: 44 },
  { label: 'Avg time', width: 62 },
  { label: '5 h', width: 42 },
  { label: 'Week', width: 46 },
];

function Cell({ i, children, head }: { i: number; children: string; head?: boolean }) {
  return (
    <T style={{ width: COLS[i]!.width, textAlign: 'right', fontSize: head ? 11.5 : 13.5, color: head ? C.muted : C.ink }}>
      {children}
    </T>
  );
}

/** Totals over the range per automation; the 5 h and Week columns are points of each limit its runs used. */
function AutomationTable({ automations, range }: { automations: AutomationMetrics[]; range: string }) {
  const color = useAutomationColor();
  return (
    <View style={{ marginBottom: 6 }}>
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

function RangeSwitch({ value, onChange }: { value: MetricsRange; onChange: (r: MetricsRange) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 999, padding: 2 }}>
      {RANGES.map((r) => {
        const on = r.value === value;
        return (
          <Pressable
            key={r.value}
            onPress={() => onChange(r.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ paddingVertical: 2, paddingHorizontal: 10, borderRadius: 999, backgroundColor: on ? C.surface : undefined }}
          >
            <T style={{ fontSize: 12, color: on ? C.ink : C.muted, fontWeight: on ? '700' : '400' }}>{r.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Metrics() {
  useTheme();
  const wide = useWide();
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

  // Side by side on wide screens; stacked, each panel takes its own height
  const half = wide ? { flex: 1 } : undefined;
  const attention = m ? (
    <Panel title="Attention" style={half}>
      <Stat first label="Time per item" m={m.attention.timePerItemSeconds} format={seconds} unit={unit} kind="line" />
      <Stat label="Approved" m={m.attention.approved} format={count} unit={unit} color={C.ok} />
      <Stat label="Rejected" m={m.attention.rejected} format={count} unit={unit} color={C.no} />
      <Stat label="Sent back" m={m.attention.sentBack} format={count} unit={unit} />
      <Stat label="Patterns automated" m={m.attention.patternsAutomated} format={count} unit={unit} kind="line" />
    </Panel>
  ) : null;
  const understanding = m ? (
    <Panel title="Understanding" style={half}>
      <Stat first label="Consistency" m={m.understanding.consistency} format={ratio} unit={unit} kind="line" color={C.ok} max={1} />
      <Stat label="Open issues" m={m.understanding.openIssues} format={count} unit={unit} kind="line" />
    </Panel>
  ) : null;
  const agents = m ? (
    <Panel title="Agents" style={half}>
      <Stat first label="Misalignments" m={m.agents.misalignments} format={count} unit={unit} color={C.ok} />
      <Stat label="Recurring issues" m={m.agents.recurringIssues} format={count} unit={unit} />
      <Stat label="Runs" m={m.agents.runs} format={count} unit={unit} />
    </Panel>
  ) : null;
  const implementation = m ? (
    <Panel title="Implementation" style={half}>
      <Stat first label="Outstanding issues" m={m.implementation.outstandingIssues} format={count} unit={unit} kind="line" />
      <Stat label="Bugs" m={m.implementation.bugs} format={count} unit={unit} kind="line" color={C.ok} />
      <Stat label="Defects" m={m.implementation.defects} format={count} unit={unit} kind="line" color={C.no} />
    </Panel>
  ) : null;

  const gap = wide ? 16 : 12;

  return (
    <ScrollView
      contentContainerStyle={
        wide
          ? { maxWidth: 860, paddingVertical: 28, paddingHorizontal: 40 }
          : { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
      }
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, zIndex: 10 }}
      >
        <Pick value={ws} options={names} onChange={setWs} />
        <RangeSwitch value={range} onChange={setRange} />
      </View>
      {m ? (
        <>
          <Panel title="Usage" style={{ marginBottom: gap }}>
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10, marginTop: 4 }}>
              <UsageTile label="Rolling 5 hours" m={m.usage.fiveHour} segments={five} unit={unit} />
              <UsageTile label="Rolling week" m={m.usage.week} segments={week} unit={unit} />
            </View>
            <UsageLegend segments={legend} />
          </Panel>
          {wide ? (
            <View style={{ gap }}>
              <View style={{ flexDirection: 'row', gap }}>
                {attention}
                {understanding}
              </View>
              <View style={{ flexDirection: 'row', gap }}>
                {agents}
                {implementation}
              </View>
            </View>
          ) : (
            <View style={{ gap }}>
              {attention}
              {understanding}
              {agents}
              {implementation}
            </View>
          )}
          <Panel title="Automations" style={{ marginTop: gap }}>
            {autos.length ? (
              <>
                <AutomationTable automations={autos} range={label} />
                <AutomationStat first label="Runs" automations={autos} pick={(a) => a.runs} format={count} unit={unit} kind="bars" />
                <AutomationStat label="Failed" automations={autos} pick={(a) => a.failed} format={count} unit={unit} kind="bars" />
                <AutomationStat label="Avg time" automations={autos} pick={(a) => a.avgSeconds} format={minutes} unit={unit} kind="line" />
                <AutomationStat label="Usage · 5-hour limit" automations={autos} pick={(a) => a.usage.fiveHour} format={pct} unit={unit} kind="bars" />
                <AutomationStat label="Usage · weekly limit" automations={autos} pick={(a) => a.usage.week} format={pct} unit={unit} kind="bars" />
              </>
            ) : (
              <T style={{ color: C.muted, fontSize: 13.5 }}>{`No runs in the last ${label}`}</T>
            )}
          </Panel>
        </>
      ) : null}
    </ScrollView>
  );
}
