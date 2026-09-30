import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';
import { C } from './theme';
import { T } from './Text';

export type ChartSeries = { key: string; label: string; color: string; values: (number | null)[] };

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

/** A bar top with rounded upper corners. */
function barTop(x: number, y: number, w: number, h: number): string {
  const r = Math.min(2, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * A time chart over the buckets `at`: bars (stacked when there are several series) or lines. Hovering or touching a
 * bucket reports its index through `onActive`, and the bucket is highlighted.
 */
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
  /** Fixed top of the value axis, such as 100 for a share of a limit */
  max?: number;
  /** Counts: the value axis stops at whole numbers */
  integer?: boolean;
  height?: number;
  active: number | null;
  onActive: (i: number | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const n = at.length;
  const plotW = Math.max(0, width - AXIS);
  const plotH = height - TOP - BOTTOM;
  const slot = n ? plotW / n : 0;
  const peak =
    kind === 'bars'
      ? Math.max(0, ...at.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0)))
      : Math.max(0, ...series.flatMap((x) => x.values.map((v) => v ?? 0)));
  const top = max ?? niceMax(peak, integer);
  const y = (v: number) => TOP + plotH - (Math.min(v, top) / top) * plotH;
  const mid = Math.floor((n - 1) / 2);

  return (
    <View style={{ height, marginTop: 4 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {active !== null ? <Rect x={AXIS + active * slot} y={TOP} width={slot} height={plotH} fill={C.card} /> : null}
          <Line x1={AXIS} x2={width} y1={y(top)} y2={y(top)} stroke={C.line} strokeWidth={1} strokeDasharray="2 3" />
          <Line x1={AXIS} x2={width} y1={y(0)} y2={y(0)} stroke={C.line} strokeWidth={1} />
          {kind === 'bars'
            ? at.map((_, i) => {
                const w = Math.max(1, slot * 0.66);
                const x = AXIS + i * slot + (slot - w) / 2;
                let base = 0;
                const parts = series
                  .map((s) => ({ s, v: s.values[i] ?? 0 }))
                  .filter((p) => p.v > 0)
                  .map((p) => {
                    const from = base;
                    base += p.v;
                    return { ...p, from, to: base };
                  });
                return parts.map((p, j) => {
                  const y0 = y(p.from);
                  const y1 = y(p.to);
                  // A 1px surface gap between stacked segments
                  const h = Math.max(j < parts.length - 1 ? y0 - y1 - 1 : y0 - y1, 0.5);
                  return j === parts.length - 1 ? (
                    <Path key={`${i}-${p.s.key}`} d={barTop(x, y0 - h, w, h)} fill={p.s.color} />
                  ) : (
                    <Rect key={`${i}-${p.s.key}`} x={x} y={y0 - h} width={w} height={h} fill={p.s.color} />
                  );
                });
              })
            : series.map((s) => {
                // Gaps where there is nothing to show break the line
                const runs: string[][] = [[]];
                s.values.forEach((v, i) => {
                  if (v === null) runs.push([]);
                  else runs[runs.length - 1]!.push(`${(AXIS + (i + 0.5) * slot).toFixed(1)},${y(v).toFixed(1)}`);
                });
                return runs
                  .filter((r) => r.length)
                  .map((r, j) =>
                    r.length === 1 ? (
                      <Rect
                        key={`${s.key}-${j}`}
                        x={Number(r[0]!.split(',')[0]) - 2}
                        y={Number(r[0]!.split(',')[1]) - 2}
                        width={4}
                        height={4}
                        rx={2}
                        fill={s.color}
                      />
                    ) : (
                      <Polyline key={`${s.key}-${j}`} points={r.join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
                    ),
                  );
              })}
        </Svg>
      ) : null}
      <T style={{ position: 'absolute', left: 0, width: AXIS - 6, top: y(top) - 7, fontSize: 10.5, color: C.muted, textAlign: 'right' }}>
        {format(top)}
      </T>
      <T style={{ position: 'absolute', left: 0, width: AXIS - 6, top: y(0) - 7, fontSize: 10.5, color: C.muted, textAlign: 'right' }}>
        {format(0)}
      </T>
      {n
        ? [0, mid, n - 1].filter((i, k, a) => a.indexOf(i) === k).map((i) => (
            <T
              key={i}
              style={{
                position: 'absolute',
                bottom: 0,
                fontSize: 10.5,
                color: C.muted,
                ...(i === 0 ? { left: AXIS } : i === n - 1 ? { right: 0 } : { left: AXIS + (i + 0.5) * slot - 20, width: 40, textAlign: 'center' }),
              }}
            >
              {tick(at[i]!, unit)}
            </T>
          ))
        : null}
      <View style={{ position: 'absolute', left: AXIS, right: 0, top: 0, bottom: BOTTOM, flexDirection: 'row' }}>
        {at.map((iso, i) => (
          <Pressable
            key={iso}
            style={{ flex: 1 }}
            accessibilityLabel={`${when(iso, unit)}: ${series.map((s) => `${s.label} ${s.values[i] === null ? 'none' : format(s.values[i]!)}`).join(', ')}`}
            onHoverIn={() => onActive(i)}
            onHoverOut={() => onActive(null)}
            onPressIn={() => onActive(i)}
          />
        ))}
      </View>
    </View>
  );
}
