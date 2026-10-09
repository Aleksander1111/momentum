// The layout audit: once a frame is laid out, every visible piece of text is measured, and whatever a viewer could not
// read is logged for scripts/audit.ts: text cut by the frame's edge, by a container that clips it, running off the card
// it sits on, or covered by something drawn over it. Also logs the large text on screen, so scripts/audit.ts can tell
// whether each stays long enough to be read.
import { useEffect, useState } from 'react';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';

const W = 1920;
const H = 1080;
/** Text fainter than this is on its way in or out, and not read */
const SEEN = 0.5;

function opacityOf(el: Element | null): number {
  let o = 1;
  for (let e = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
    o *= Number(cs.opacity);
  }
  return o;
}

const solid = (color: string) => {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1]!.split(',').map((x) => Number(x.trim()));
  return (parts[3] ?? 1) > 0.5;
};

/** Partly in and partly out of `box`, by more than a few pixels */
const crosses = (r: DOMRect, box: DOMRect, slack = 3) => {
  const inside = r.left >= box.left - slack && r.right <= box.right + slack && r.top >= box.top - slack && r.bottom <= box.bottom + slack;
  const outside = r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom;
  return !inside && !outside;
};

const name = (e: Element) => `${e.tagName.toLowerCase()}${(e.textContent ?? '').trim() ? ` "${(e.textContent ?? '').trim().slice(0, 30)}"` : ''}`;

function audit(): string[] {
  // Overlays that let clicks through still cover what is under them: hit-test everything
  const all = document.createElement('style');
  all.textContent = '* { pointer-events: auto !important; }';
  document.head.appendChild(all);
  const issues: string[] = [];
  const frame = new DOMRect(0, 0, W, H);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim();
    const el = node.parentElement;
    if (!text || !el || opacityOf(el) < SEEN) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2);
    const label = `"${text.slice(0, 40)}"`;
    const size = parseFloat(getComputedStyle(el).fontSize);
    for (const r of rects) {
      if (crosses(r, frame, 2)) issues.push(`${label} cut by the frame's edge`);
      for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.textOverflow === 'ellipsis') break;
        if (cs.overflow !== 'visible' && crosses(r, a.getBoundingClientRect())) {
          issues.push(`${label} cut by ${name(a).slice(0, 50)}`);
          break;
        }
      }
      // The nearest card or pill under it: a solid, rounded box
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (solid(cs.backgroundColor) && parseFloat(cs.borderTopLeftRadius) > 0) {
          if (crosses(r, a.getBoundingClientRect(), 4)) issues.push(`${label} runs off its card`);
          break;
        }
      }
    }
    // Covered: what is drawn on top at the middle of each line of large text
    if (size >= 24) {
      for (const r of rects) {
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x > W || y > H) continue;
        const top = document.elementsFromPoint(x, y)[0];
        if (!top || top === el || el.contains(top) || top.contains(el)) continue;
        const cs = getComputedStyle(top);
        if (opacityOf(top) > SEEN && (solid(cs.backgroundColor) || ['path', 'circle', 'rect', 'ellipse', 'line'].includes(top.tagName))) issues.push(`${label} covered by ${name(top).slice(0, 50)}`);
      }
    }
  }
  all.remove();
  return [...new Set(issues)];
}

/** Text large enough to be meant to be read (a headline, a caption, a line on screen), by the block it belongs to */
function readable(): string[] {
  const blocks = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!(node.textContent ?? '').trim() || !el || opacityOf(el) < SEEN || parseFloat(getComputedStyle(el).fontSize) < READ_SIZE) continue;
    const r = el.getBoundingClientRect();
    if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    let block: Element = el;
    while (block.parentElement && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
    blocks.add((block.textContent ?? '').replace(/\s+/g, ' ').trim());
  }
  return [...blocks];
}
const READ_SIZE = 36;

/** Measures each frame once it is laid out, and logs what it finds for the audit script */
export function LayoutAudit() {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender('layout audit'));
  useEffect(() => {
    requestAnimationFrame(() => {
      const issues = audit();
      if (issues.length) console.log(`AUDIT ${frame} ${JSON.stringify(issues)}`);
      console.log(`READ ${frame} ${JSON.stringify(readable())}`);
      continueRender(handle);
    });
  }, [frame, handle]);
  return null;
}
