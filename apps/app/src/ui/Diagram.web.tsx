import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { DiagramElement } from '@momentum/contract';
import { AddsAtOnce, AddToContext } from './AddToContext';
import { DiagramFull } from './DiagramFull';
import { naturalText, svgSize } from './svgSize';
import { C } from './theme';

/** PlantUML pins width and height; without them the drawing scales to the box it is given */
function inline(svg: string): string {
  return naturalText(svg).replace(/<svg\b[^>]*>/i, (open) =>
    open
      .replace(/\s(width|height)="[^"]*"/gi, '')
      .replace(/\sstyle="[^"]*"/i, '')
      .replace(/\spreserveAspectRatio="[^"]*"/i, '')
      .replace(/<svg/i, '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'),
  );
}

const glow = (blur: number) => `drop-shadow(0 0 ${blur / 3}px ${C.accent}) drop-shadow(0 0 ${blur}px ${C.accent})`;

/**
 * Web: the SVG inline, scaled to the card width. A click on a shape picks it, the rest fades, and "Add to context" adds
 * what it reads as to the chat's context; a click beside the shapes drops the pick, or opens the diagram full size.
 * Where picks go at once (AddsAtOnce), a click on a shape adds it.
 */
export function Diagram({ svg, elements, onAdd }: { svg: string; elements?: DiagramElement[]; onAdd?: (element: string) => void }) {
  const [box, setBox] = useState(0);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const host = useRef<View>(null);
  const size = useMemo(() => svgSize(svg), [svg]);
  const markup = useMemo(() => inline(svg), [svg]);
  const width = Math.min(size.width, box);
  const height = width / size.ratio;
  const pickable = !!onAdd && !!elements?.length;
  const atOnce = useContext(AddsAtOnce);

  useEffect(() => setPicked(null), [svg]);

  // Highlight the pick: glow on its shapes, the others faded
  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (!node) return;
    for (const g of node.querySelectorAll<SVGGElement>('[data-pick]')) {
      const on = picked !== null && g.dataset.pick === String(picked);
      g.style.cursor = pickable ? 'pointer' : '';
      g.style.transition = 'opacity 120ms ease';
      g.style.opacity = picked !== null && !on ? '0.18' : '';
      g.style.filter = on ? glow(8) : '';
    }
  }, [picked, markup, pickable, box]);

  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (!node || !pickable) return;
    const shape = (e: Event) => (e.target as Element).closest?.('[data-pick]') as SVGGElement | null;
    const over = (e: Event) => {
      const g = shape(e);
      if (g && g.dataset.pick !== String(picked)) g.style.filter = glow(6);
    };
    const out = (e: Event) => {
      const g = shape(e);
      if (g && g.dataset.pick !== String(picked)) g.style.filter = '';
    };
    node.addEventListener('mouseover', over);
    node.addEventListener('mouseout', out);
    return () => {
      node.removeEventListener('mouseover', over);
      node.removeEventListener('mouseout', out);
    };
  }, [pickable, picked, markup]);

  const click = (target: EventTarget) => {
    const g = pickable ? ((target as Element).closest?.('[data-pick]') as SVGGElement | null) : null;
    const element = g ? elements?.[Number(g.dataset.pick)] : undefined;
    if (element && atOnce) onAdd!(element.name);
    else if (g) setPicked(Number(g.dataset.pick) === picked ? null : Number(g.dataset.pick));
    else if (picked !== null) setPicked(null);
    else setOpen(true);
  };

  const pick = picked !== null ? elements?.[picked] : undefined;
  const scale = size.width > 0 ? width / (svgViewWidth(svg) ?? size.width) : 1;

  const img = (w: number, h: number) => (
    <div style={{ width: w, height: h, display: 'block' }} dangerouslySetInnerHTML={{ __html: markup }} />
  );

  return (
    <>
      <View
        accessibilityRole="button"
        accessibilityLabel="Diagram: pick a shape, or open it full size"
        onLayout={(e) => setBox(e.nativeEvent.layout.width)}
        style={{ alignItems: 'center', marginTop: 6, marginBottom: 10, backgroundColor: C.diagram, borderRadius: 10, userSelect: 'none' }}
      >
        {box > 0 ? (
          <View ref={host} style={{ width, height, cursor: 'pointer' }} {...({ onClick: (e: { target: EventTarget }) => click(e.target) } as object)}>
            {img(width, height)}
            {pick && onAdd ? (
              <AddToContext
                onPress={() => {
                  onAdd(pick.name);
                  setPicked(null);
                }}
                style={{
                  position: 'absolute',
                  left: Math.max(0, Math.min(pick.box[0] * scale, width - 130)),
                  top: Math.min((pick.box[1] + pick.box[3]) * scale + 6, height - 30),
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      <DiagramFull open={open} onClose={() => setOpen(false)} size={size} render={img} />
    </>
  );
}

function svgViewWidth(svg: string): number | null {
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)/i.exec(svg);
  return vb ? Number(vb[1]) : null;
}
