import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { AutomationMetrics, MetricValue } from '@momentum/contract';
import { api } from '../../lib/api';
import { automationLabel, usagePct } from '../../lib/format';
import { useCurrentWorkspace } from '../../lib/workspace';
import { C, F, useTheme, useWide } from '../../ui/theme';
import { H, T } from '../../ui/Text';
import { Count, Pick } from '../../ui/parts';
import { Sparkline } from '../../ui/Sparkline';
import { UsageLegend, UsageMeter, useAutomationColor, useSegments, type Segment } from '../../ui/UsageMeter';

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
      <H style={{ fontSize: 15, marginBottom: 8 }}>{title}</H>
      {children}
    </View>
  );
}

function Stat({
  label,
  value,
  metric,
  color = C.muted,
}: {
  label: string;
  value: string;
  metric?: MetricValue;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        borderTopWidth: 1,
        borderTopColor: C.line,
        borderStyle: 'dashed',
      }}
    >
      <T style={{ color: C.muted, fontSize: 13.5 }}>{label}</T>
      {metric ? <Sparkline series={metric.series} color={color} /> : <View style={{ flex: 1 }} />}
      <T style={{ fontSize: 15, fontWeight: '700' }}>{value}</T>
    </View>
  );
}

function UsageTile({ label, pct, segments }: { label: string; pct: number | null; segments: Segment[] }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
      <T style={{ color: C.muted, fontSize: 11.5 }}>{label}</T>
      <T style={{ fontSize: 18, fontFamily: F.head, fontWeight: '700' }}>{pct === null ? '—' : `${Math.round(pct)}%`}</T>
      <UsageMeter segments={segments} />
    </View>
  );
}

/** "<1 min", "14 min", "2 h 5 min"; a dash when no run ended. */
function avgTime(seconds: number | null): string {
  if (seconds === null) return '—';
  const min = Math.round(seconds / 60);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  return min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`;
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

function AutomationTable({ automations }: { automations: AutomationMetrics[] }) {
  const color = useAutomationColor();
  if (!automations.length) return <T style={{ color: C.muted, fontSize: 13.5 }}>No runs in the last 7 days</T>;
  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
        <T style={{ flex: 1, color: C.muted, fontSize: 11.5 }}>Last 7 days</T>
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
          <Cell i={0}>{String(a.runs)}</Cell>
          <Cell i={1}>{String(a.failed)}</Cell>
          <Cell i={2}>{avgTime(a.avgSeconds)}</Cell>
          <Cell i={3}>{usagePct(a.usage.fiveHour)}</Cell>
          <Cell i={4}>{usagePct(a.usage.week)}</Cell>
        </View>
      ))}
    </View>
  );
}

const int = (m: MetricValue) => String(Math.round(m.value));

export default function Metrics() {
  useTheme();
  const wide = useWide();
  const [ws, setWs, names] = useCurrentWorkspace();
  const { data: m } = useQuery({ queryKey: ['metrics', ws], queryFn: () => api.metrics(ws as string), enabled: !!ws });

  const five = useSegments(m?.agents.automations ?? [], 'fiveHour', m?.usage.fiveHour ?? null);
  const week = useSegments(m?.agents.automations ?? [], 'week', m?.usage.week ?? null);
  const legend = [...week, ...five.filter((f) => !week.some((w) => w.key === f.key))];

  const days = m ? Math.max(1, Math.round((Date.now() - new Date(m.since).getTime()) / 86_400_000)) : null;

  const attention = m ? (
    <Panel title="Attention" style={{ flex: 1 }}>
      <Stat label="Time per item" value={`${Math.round(m.attention.timePerItemSeconds.value)} s`} metric={m.attention.timePerItemSeconds} />
      <Stat label="Approved" value={int(m.attention.approved)} metric={m.attention.approved} color={C.ok} />
      <Stat label="Rejected" value={int(m.attention.rejected)} metric={m.attention.rejected} color={C.no} />
      <Stat label="Sent back" value={int(m.attention.sentBack)} metric={m.attention.sentBack} />
      <Stat label="Patterns automated" value={String(m.attention.patternsAutomated)} />
    </Panel>
  ) : null;
  const understanding = m ? (
    <Panel title="Understanding" style={{ flex: 1 }}>
      <Stat label="Consistency" value={m.understanding.consistency.value.toFixed(2)} metric={m.understanding.consistency} color={C.ok} />
      <Stat label="Open issues" value={int(m.understanding.openIssues)} metric={m.understanding.openIssues} />
    </Panel>
  ) : null;
  const agents = m ? (
    <Panel title="Agents" style={{ flex: 1 }}>
      <Stat label="Misalignments" value={int(m.agents.misalignments)} metric={m.agents.misalignments} color={C.ok} />
      <Stat label="Recurring issues" value={int(m.agents.recurringIssues)} metric={m.agents.recurringIssues} />
      <Stat label="Runs this week" value={int(m.agents.runsThisWeek)} metric={m.agents.runsThisWeek} />
    </Panel>
  ) : null;
  const implementation = m ? (
    <Panel title="Implementation" style={{ flex: 1 }}>
      <Stat label="Outstanding issues" value={int(m.implementation.outstandingIssues)} metric={m.implementation.outstandingIssues} />
      <Stat label="Bugs" value={int(m.implementation.bugs)} metric={m.implementation.bugs} color={C.ok} />
      <Stat label="Defects" value={int(m.implementation.defects)} metric={m.implementation.defects} color={C.no} />
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
        {days ? <Count>{`last ${days} days`}</Count> : null}
      </View>
      {m ? (
        <>
          <Panel title="Usage" style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <UsageTile label="Rolling 5 hours" pct={m.usage.fiveHour} segments={five} />
              <UsageTile label="Rolling week" pct={m.usage.week} segments={week} />
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
            <AutomationTable automations={m.agents.automations} />
          </Panel>
        </>
      ) : null}
    </ScrollView>
  );
}
