import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { SvgCss } from 'react-native-svg/css';
import { DiagramFull } from './DiagramFull';
import { svgSize } from './svgSize';
import { C } from './theme';

/** Native: server-rendered mermaid SVG with its embedded <style>, scaled to the card width; a tap opens it full size. */
export function Diagram({ svg }: { svg: string }) {
  const [box, setBox] = useState(0);
  const [open, setOpen] = useState(false);
  const size = useMemo(() => svgSize(svg), [svg]);
  const width = Math.min(size.width, box);
  const img = (w: number, h: number) => <SvgCss xml={svg} width={w} height={h} />;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open diagram full size"
        onLayout={(e) => setBox(e.nativeEvent.layout.width)}
        style={{ alignItems: 'center', marginTop: 6, marginBottom: 10, backgroundColor: C.diagram, borderRadius: 10 }}
      >
        {box > 0 ? img(width, width / size.ratio) : null}
      </Pressable>
      <DiagramFull open={open} onClose={() => setOpen(false)} size={size} render={img} />
    </>
  );
}
