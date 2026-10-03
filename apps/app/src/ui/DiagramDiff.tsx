import { useEffect, useSyncExternalStore } from 'react';
import { Platform, Pressable, View } from 'react-native';
import type { DiagramElement, RenderedDiagram, Span } from '@momentum/contract';
import { Diagram } from './Diagram';
import { C, F } from './theme';
import { T } from './Text';

type Side = 'before' | 'after' | 'diff';

// One tab for every changed diagram on screen, as in the stock-fly-8 knowledge base
let side: Side = 'after';
const listeners = new Set<() => void>();
const setSide = (s: Side) => {
  side = s;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The source diff of code or a diagram: removed and added runs marked */
export function SpanText({ spans, size = 13 }: { spans: Span[]; size?: number }) {
  return (
    <T style={{ fontFamily: F.mono, fontSize: size }}>
      {spans.map((s, i) =>
        s.k === 'eq' ? (
          s.v
        ) : (
          <T
            key={i}
            style={{
              fontFamily: F.mono,
              fontSize: size,
              backgroundColor: s.k === 'ins' ? C.ins : C.del,
              textDecorationLine: s.k === 'del' ? 'line-through' : 'none',
            }}
          >
            {s.v}
          </T>
        ),
      )}
    </T>
  );
}

const TABS: { side: Side; label: string; colour: () => string; wash: () => string }[] = [
  { side: 'before', label: 'Before', colour: () => C.no, wash: () => C.del },
  { side: 'after', label: 'After', colour: () => C.ok, wash: () => C.ins },
  { side: 'diff', label: 'Diff', colour: () => C.accent, wash: () => C.card },
];

/** A changed diagram: Before and After rendered, Diff its source with the changes marked; ← and → switch on the web */
export function DiagramDiff({
  svg,
  elements,
  before,
  diff,
  onAdd,
}: {
  svg: string;
  elements?: DiagramElement[];
  before: RenderedDiagram;
  diff: Span[];
  onAdd?: (element: string) => void;
}) {
  const current = useSyncExternalStore(subscribe, () => side, () => side);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest?.('input, textarea, [contenteditable="true"]');
      if (typing) return;
      if (e.key === 'ArrowLeft') setSide('before');
      else if (e.key === 'ArrowRight') setSide('after');
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  return (
    <View style={{ marginTop: 6, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
        {TABS.map((t) => {
          const on = current === t.side;
          return (
            <Pressable
              key={t.side}
              onPress={() => setSide(t.side)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: on ? t.colour() : C.line,
                backgroundColor: on ? t.wash() : C.surface,
              }}
            >
              <T style={{ fontSize: 13 }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>
      {current === 'before' ? <Diagram svg={before.svg} elements={before.elements} onAdd={onAdd} /> : null}
      {current === 'after' ? <Diagram svg={svg} elements={elements} onAdd={onAdd} /> : null}
      {current === 'diff' ? (
        <View style={{ backgroundColor: C.card, borderRadius: 8, padding: 10 }}>
          <SpanText spans={diff} />
        </View>
      ) : null}
    </View>
  );
}
