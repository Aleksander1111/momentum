import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { View } from 'react-native';
import { AddToContext } from './AddToContext';

type Caret = { node: Node; offset: number };

function caretAt(x: number, y: number): Caret | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const p = doc.caretPositionFromPoint?.(x, y);
  if (p) return { node: p.offsetNode, offset: p.offset };
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/**
 * Web: text selected inside a card offers "Add to context" under the selection. The right mouse button drags a
 * selection anywhere on the card; on a card that swipes (`swipe`) the left button only swipes, elsewhere it selects as
 * usual. Touch keeps the browser's own long-press selection.
 */
export function SelectionScope({
  onAdd,
  swipe,
  children,
}: {
  onAdd: (quote: string, block: number | null) => void;
  swipe?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  const [at, setAt] = useState<{ x: number; y: number; quote: string; block: number | null } | null>(null);

  useEffect(() => {
    const host = ref.current as unknown as HTMLElement | null;
    if (!host) return;
    let anchor: Caret | null = null;
    let leftDown = false;

    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setAt(null);
      const range = sel.getRangeAt(0);
      if (!host.contains(range.commonAncestorContainer)) return setAt(null);
      const quote = sel.toString().replace(/\s+/g, ' ').trim();
      if (!quote) return setAt(null);
      const rect = range.getBoundingClientRect();
      const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const block = start?.closest('[data-block]')?.getAttribute('data-block');
      setAt({ x: rect.left + rect.width / 2, y: rect.bottom + 8, quote, block: block != null ? Number(block) : null });
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      leftDown = e.button === 0;
      if (e.button !== 2) return;
      e.preventDefault();
      anchor = caretAt(e.clientX, e.clientY);
      window.getSelection()?.removeAllRanges();
      try {
        host.setPointerCapture(e.pointerId);
      } catch {
        // a pointer the browser no longer tracks: the drag still selects while it stays over the card
      }
    };
    const move = (e: PointerEvent) => {
      if (!anchor) return;
      const focus = caretAt(e.clientX, e.clientY);
      if (focus) window.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
    };
    const up = (e: PointerEvent) => {
      leftDown = false;
      if (!anchor) return;
      anchor = null;
      if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    };
    // The left button swipes the card: it starts no selection there
    const selectStart = (e: Event) => {
      if (swipe && leftDown) e.preventDefault();
    };
    const menu = (e: Event) => e.preventDefault();
    const scrolled = () => setAt(null);

    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', scrolled, true);
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('selectstart', selectStart);
    host.addEventListener('contextmenu', menu);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', scrolled, true);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
      host.removeEventListener('selectstart', selectStart);
      host.removeEventListener('contextmenu', menu);
    };
  }, [swipe]);

  return (
    <View ref={ref} style={{ userSelect: 'text' }}>
      {children}
      {at
        ? createPortal(
            <Floating x={at.x} y={at.y}>
              <AddToContext
                onPress={() => {
                  onAdd(at.quote, at.block);
                  window.getSelection()?.removeAllRanges();
                  setAt(null);
                }}
              />
            </Floating>,
            document.body,
          )
        : null}
    </View>
  );
}

/** Over the page, outside the card (a swiping card is transformed); pressing it keeps the selection */
function Floating({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const node = ref.current as unknown as HTMLElement | null;
    const keep = (e: Event) => e.preventDefault();
    node?.addEventListener('mousedown', keep);
    return () => node?.removeEventListener('mousedown', keep);
  }, []);
  return (
    <View
      ref={ref}
      style={{
        position: 'fixed' as 'absolute',
        left: Math.max(8, Math.min(x - 64, window.innerWidth - 140)),
        top: Math.min(y, window.innerHeight - 44),
        zIndex: 20,
      }}
    >
      {children}
    </View>
  );
}
