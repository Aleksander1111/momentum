import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';
import { C } from './theme';
import { T } from './Text';

export type ChartSeries = { key: string; label: string; color: string; values: (number | null)[] };

/** One metric on a chart: its series stacked into bars, or a line each, read against one of the value axes */
export type ChartLayer = { key: string; label: string; kind: 'bars' | 'line'; axis: 0 | 1; series: ChartSeries[] };

export type ChartAxis = {
  format: (v: number) => string;
  /** Counts: the axis stops at whole numbers */
  integer?: boolean;
  /** Fixed top of the axis, such as 100 for a share of a limit */
  max?: number;
};

/** A label under the plot; `at` is in slots from the left edge, so 0.5 is the middle of the first slot */
export type ChartTick = { at: number; text: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Axis label of a bucket: "14:00" for hours, "12 Sep" for days. */
export function tick(iso: string, unit: 'hour' | 'day'): string {
  const d = new Date(iso);
  return unit === 'hour' ? `${String(d.getHours()).padStart(2, '0')}:00` : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Readout label of a bucket: "Wed 14:00", "Wed 12 Sep". */
export function when(iso: string, unit: 'hour' | 'day'): string {
  return `${WEEKDAYS[new Date(iso).getDay()]} ${tick(iso, unit)}`;
}

/** The first, middle and last bucket of a time axis. */
export function timeTicks(at: string[], unit: 'hour' | 'day'): ChartTick[] {
  const n = at.length;
  if (!n) return [];
  return [0, Math.floor((n - 1) / 2), n - 1]
    .filter((i, k, a) => a.indexOf(i) === k)
    .map((i) => ({ at: i + 0.5, text: tick(at[i]!, unit) }));
}

/** The smallest of 1, 2, 2.5, 5 × 10ⁿ at or above v; 2.5 is skipped for counts. */
function niceMax(v: number, integer: boolean): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const steps = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  return (steps.find((s) => s * p >= v - 1e-9) ?? 10) * p;
}

const AXIS = 34;
const TOP = 6;
const BOTTOM = 16;
const TICK = 44;

/** A bar top with rounded upper corners. */
function barTop(x: number, y: number, w: number, h: number): string {
  const r = Math.min(2, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** The highest point of the layers read against one axis: stacked sums for bars, single values for lines. */
function peakOf(layers: ChartLayer[], n: number): number {
  let peak = 0;
  for (const l of layers) {
    for (let i = 0; i < n; i++) {
      peak = Math.max(
        peak,
        l.kind === 'bars' ? l.series.reduce((s, x) => s + (x.values[i] ?? 0), 0) : Math.max(0, ...l.series.map((x) => x.values[i] ?? 0)),
      );
    }
  }
  return peak;
}

/**
 * A chart over `labels.length` slots, such as the buckets of a time range or the bins of a histogram. Bar layers stand
 * side by side in each slot, each stacked from its series; lines are drawn over them. Each layer reads against the left
 * or the right axis. Hovering or touching a slot reports its index through `onActive`, and the slot is highlighted.
 */
export function Chart({
  labels,
  ticks,
  layers,
  axes,
  height = 64,
  active,
  onActive,
}: {
  /** What each slot is, for screen readers */
  labels: string[];
  ticks: ChartTick[];
  layers: ChartLayer[];
  axes: [ChartAxis] | [ChartAxis, ChartAxis];
  height?: number;
  active: number | null;
  onActive: (i: number | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const n = labels.length;
  const right = axes.length > 1 ? AXIS : 0;
  const plotW = Math.max(0, width - AXIS - right);
  const plotH = height - TOP - BOTTOM;
  const slot = n ? plotW / n : 0;
  const tops = axes.map((a, k) => a.max ?? niceMax(peakOf(layers.filter((l) => l.axis === k), n), a.integer ?? false));
  const y = (v: number, k: number) => TOP + plotH - (Math.min(v, tops[k]!) / tops[k]!) * plotH;
  const bars = layers.filter((l) => l.kind === 'bars');
  const group = Math.max(1, slot * 0.7);
  const w = Math.max(1, (group - (bars.length - 1)) / Math.max(1, bars.length));
  const fmt = (l: ChartLayer, v: number | null) => (v === null ? 'none' : axes[l.axis]!.format(v));

  return (
    <View style={{ height, marginTop: 4 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {active !== null ? <Rect x={AXIS + active * slot} y={TOP} width={slot} height={plotH} fill={C.card} /> : null}
          <Line x1={AXIS} x2={AXIS + plotW} y1={TOP} y2={TOP} stroke={C.line} strokeWidth={1} strokeDasharray="2 3" />
          <Line x1={AXIS} x2={AXIS + plotW} y1={TOP + plotH} y2={TOP + plotH} stroke={C.line} strokeWidth={1} />
          {bars.map((l, b) =>
            labels.map((_, i) => {
              const x = AXIS + i * slot + (slot - group) / 2 + b * (w + 1);
              let base = 0;
              const parts = l.series
                .map((s) => ({ s, v: s.values[i] ?? 0 }))
                .filter((p) => p.v > 0)
                .map((p) => {
                  const from = base;
                  base += p.v;
                  return { ...p, from, to: base };
                });
              return parts.map((p, j) => {
                const y0 = y(p.from, l.axis);
                const y1 = y(p.to, l.axis);
                // A 1px surface gap between stacked segments
                const h = Math.max(j < parts.length - 1 ? y0 - y1 - 1 : y0 - y1, 0.5);
                const key = `${l.key}-${i}-${p.s.key}`;
                return j === parts.length - 1 ? (
                  <Path key={key} d={barTop(x, y0 - h, w, h)} fill={p.s.color} />
                ) : (
                  <Rect key={key} x={x} y={y0 - h} width={w} height={h} fill={p.s.color} />
                );
              });
            }),
          )}
          {layers
            .filter((l) => l.kind === 'line')
            .flatMap((l) =>
              l.series.map((s) => {
                // Gaps where there is nothing to show break the line
                const runs: [number, number][][] = [[]];
                s.values.forEach((v, i) => {
                  if (v === null) runs.push([]);
                  else runs[runs.length - 1]!.push([AXIS + (i + 0.5) * slot, y(v, l.axis)]);
                });
                return runs
                  .filter((r) => r.length)
                  .map((r, j) =>
                    r.length === 1 ? (
                      <Rect key={`${l.key}-${s.key}-${j}`} x={r[0]![0] - 2} y={r[0]![1] - 2} width={4} height={4} rx={2} fill={s.color} />
                    ) : (
                      <Polyline
                        key={`${l.key}-${s.key}-${j}`}
                        points={r.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                      />
                    ),
                  );
              }),
            )}
        </Svg>
      ) : null}
      {axes.map((a, k) =>
        [tops[k]!, 0].map((v) => (
          <T
            key={`${k}-${v}`}
            style={{
              position: 'absolute',
              top: y(v, k) - 7,
              width: AXIS - 6,
              fontSize: 10.5,
              color: C.muted,
              ...(k === 0 ? { left: 0, textAlign: 'right' } : { right: 0, textAlign: 'left' }),
            }}
          >
            {a.format(v)}
          </T>
        )),
      )}
      {ticks.map((t) => {
        const x = t.at * slot;
        const place =
          x < TICK / 2 ? { left: AXIS } : x > plotW - TICK / 2 ? { right: right } : { left: AXIS + x - TICK / 2, width: TICK, textAlign: 'center' as const };
        return (
          <T key={`${t.at}-${t.text}`} style={{ position: 'absolute', bottom: 0, fontSize: 10.5, color: C.muted, ...place }}>
            {t.text}
          </T>
        );
      })}
      <View style={{ position: 'absolute', left: AXIS, right, top: 0, bottom: BOTTOM, flexDirection: 'row' }}>
        {labels.map((label, i) => (
          <Pressable
            key={i}
            style={{ flex: 1 }}
            accessibilityLabel={`${label}: ${layers
              .flatMap((l) => l.series.map((s) => `${s.label} ${fmt(l, s.values[i] ?? null)}`))
              .join(', ')}`}
            onHoverIn={() => onActive(i)}
            onHoverOut={() => onActive(null)}
            onPressIn={() => onActive(i)}
          />
        ))}
      </View>
    </View>
  );
}

/** One measure over the buckets `at`: bars (stacked when there are several series) or lines, against one axis. */
export function TimeChart({
  at,
  unit,
  series,
  kind,
  format,
  max,
  integer = false,
  height = 64,
  active,
  onActive,
}: {
  at: string[];
  unit: 'hour' | 'day';
  series: ChartSeries[];
  kind: 'bars' | 'line';
  format: (v: number) => string;
  max?: number;
  integer?: boolean;
  height?: number;
  active: number | null;
  onActive: (i: number | null) => void;
}) {
  return (
    <Chart
      labels={at.map((iso) => when(iso, unit))}
      ticks={timeTicks(at, unit)}
      layers={[{ key: 'only', label: '', kind, axis: 0, series }]}
      axes={[{ format, integer, max }]}
      height={height}
      active={active}
      onActive={onActive}
    />
  );
}
