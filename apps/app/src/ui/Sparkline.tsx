import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { Series } from '@momentum/contract';

const W = 90;
const H = 22;

/** 90×22 polyline of a metric series, as in the Metrics design. */
export function Sparkline({ series, color }: { series: Series; color: string }) {
  if (series.length < 2) return <View style={{ width: W, height: H, marginLeft: 'auto', marginRight: 12 }} />;
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = max === min ? H / 2 : 18 - ((v - min) / (max - min)) * 14;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginLeft: 'auto', marginRight: 12 }}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}
