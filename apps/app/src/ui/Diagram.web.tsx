import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { svgSize } from './svgSize';

/** Web: the SVG as an image data URI, which keeps its embedded <style>, scaled to the card width. */
export function Diagram({ svg }: { svg: string }) {
  const [box, setBox] = useState(0);
  const size = useMemo(() => svgSize(svg), [svg]);
  const uri = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, [svg]);
  const width = Math.min(size.width, box);
  return (
    <View
      onLayout={(e) => setBox(e.nativeEvent.layout.width)}
      style={{ alignItems: 'center', marginTop: 6, marginBottom: 10 }}
    >
      {box > 0 ? <img src={uri} alt="" draggable={false} style={{ width, height: width / size.ratio, display: 'block' }} /> : null}
    </View>
  );
}
