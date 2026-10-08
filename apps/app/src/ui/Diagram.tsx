import { useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SvgCss } from 'react-native-svg/css';
import type { DiagramElement } from '@momentum/contract';
import { AddsAtOnce, AddToContext } from './AddToContext';
import { DiagramFull } from './DiagramFull';
import { naturalText, svgSize } from './svgSize';
import { C } from './theme';

/** A thin arrow is hard to hit with a finger: its box counts this far around it */
const SLOP = 8;

/** The other shapes faded while one is picked; css-select reads the data-pick stamps of the server */
function faded(svg: string, picked: number): string {
  const css = `<style>[data-pick]{opacity:.18}[data-pick="${picked}"]{opacity:1}</style>`;
  return svg.replace(/<\/svg>\s*$/i, `${css}</svg>`);
}

/**
 * Native: server-rendered PlantUML SVG, scaled to the card width. A tap on a shape picks it (the smallest box under the
 * finger), the rest fades, and "Add to context" adds what it reads as to the chat's context; a tap beside the shapes
 * drops the pick, or opens the diagram full size. Where picks go at once (AddsAtOnce), a tap on a shape adds it.
 */
export function Diagram({ svg, elements, onAdd }: { svg: string; elements?: DiagramElement[]; onAdd?: (element: string) => void }) {
  const [box, setBox] = useState(0);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const size = useMemo(() => svgSize(svg), [svg]);
  const viewWidth = useMemo(() => Number(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)/i.exec(svg)?.[1]) || size.width, [svg, size]);
  const width = Math.min(size.width, box);
  const height = width / size.ratio;
  const scale = width / viewWidth;
  const pickable = !!onAdd && !!elements?.length;
  const atOnce = useContext(AddsAtOnce);
  const shown = useMemo(() => (picked !== null ? faded(naturalText(svg), picked) : naturalText(svg)), [svg, picked]);

  useEffect(() => setPicked(null), [svg]);

  const tap = (x: number, y: number) => {
    const hit = pickable
      ? elements!
          .map((e, i) => ({ i, e }))
          .filter(({ e }) => {
            const [ex, ey, ew, eh] = e.box.map((v) => v * scale) as [number, number, number, number];
            return x >= ex - SLOP && x <= ex + ew + SLOP && y >= ey - SLOP && y <= ey + eh + SLOP;
          })
          .sort((a, b) => a.e.box[2] * a.e.box[3] - b.e.box[2] * b.e.box[3])[0]
      : undefined;
    if (hit && atOnce) onAdd!(hit.e.name);
    else if (hit) setPicked(hit.i === picked ? null : hit.i);
    else if (picked !== null) setPicked(null);
    else setOpen(true);
  };

  const pick = picked !== null ? elements?.[picked] : undefined;
  const img = (w: number, h: number) => <SvgCss xml={svg} width={w} height={h} />;

  return (
    <>
      <View
        onLayout={(e) => setBox(e.nativeEvent.layout.width)}
        style={{ alignItems: 'center', marginTop: 6, marginBottom: 10, backgroundColor: C.diagram, borderRadius: 10 }}
      >
        {box > 0 ? (
          <Pressable
            onPress={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
            accessibilityRole="button"
            accessibilityLabel="Diagram: tap a shape to pick it, or beside the shapes to open it full size"
            style={{ width, height }}
          >
            <SvgCss xml={shown} width={width} height={height} />
            {pick ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: pick.box[0] * scale - 4,
                  top: pick.box[1] * scale - 4,
                  width: pick.box[2] * scale + 8,
                  height: pick.box[3] * scale + 8,
                  borderWidth: 2,
                  borderColor: C.pick,
                  borderRadius: 6,
                }}
              />
            ) : null}
            {pick && onAdd ? (
              <AddToContext
                onPress={() => {
                  onAdd(pick.name);
                  setPicked(null);
                }}
                style={{
                  position: 'absolute',
                  left: Math.max(0, Math.min(pick.box[0] * scale, width - 130)),
                  top: Math.min((pick.box[1] + pick.box[3]) * scale + 8, height - 30),
                }}
              />
            ) : null}
          </Pressable>
        ) : null}
      </View>
      <DiagramFull open={open} onClose={() => setOpen(false)} size={size} render={img} />
    </>
  );
}
