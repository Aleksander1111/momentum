import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { SvgCss } from 'react-native-svg/css';
import { svgSize } from './svgSize';
import { C } from './theme';

/** Native: server-rendered mermaid SVG with its embedded <style>, scaled to the card width. */
export function Diagram({ svg }: { svg: string }) {
  const [box, setBox] = useState(0);
  const size = useMemo(() => svgSize(svg), [svg]);
  const width = Math.min(size.width, box);
  return (
    <View
      onLayout={(e) => setBox(e.nativeEvent.layout.width)}
      style={{ alignItems: 'center', marginTop: 6, marginBottom: 10, backgroundColor: C.diagram, borderRadius: 10 }}
    >
      {box > 0 ? <SvgCss xml={svg} width={width} height={width / size.ratio} /> : null}
    </View>
  );
}
