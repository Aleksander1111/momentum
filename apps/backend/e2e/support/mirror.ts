import type { Page } from '@playwright/test';
import { OBSERVER } from '../observer/post.ts';

/** As often as the window can be shot while a page watches it; otherwise now and then, so a page switching to it sees it at once */
const WATCHED_MS = 80;
const UNWATCHED_MS = 2000;

/**
 * What the scenario's own window shows, sent to the runner: the runs drive a Firefox out of sight, so the runner's page
 * shows these frames to whoever watches, the app as the test uses it, every tap and page.
 */
export function mirror(page: Page, id: string): { stop(): Promise<void> } {
  let on = true;
  let watched = false;
  const loop = (async () => {
    while (on) {
      const started = Date.now();
      // The app and its timeline as the window shows them: clipped to their box, never scrolled to
      const box = await page.locator('#device').boundingBox().catch(() => null);
      const view = page.viewportSize();
      const clip = box && view ? { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, view.width - Math.max(0, box.x)), height: Math.min(box.height, view.height - Math.max(0, box.y)) } : undefined;
      // At the window's device scale, sharp on a high-density screen; plain text and lines stay crisp at this quality
      const shot = await page.screenshot({ type: 'jpeg', quality: 85, scale: 'device', animations: 'allow', caret: 'initial', timeout: 5000, ...(clip ? { clip } : {}) }).catch(() => null);
      if (shot && on) {
        watched = await fetch(`${OBSERVER}/frame?id=${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'content-type': 'image/jpeg', connection: 'close' },
          body: new Uint8Array(shot),
        })
          .then((r) => r.json() as Promise<{ watched?: boolean }>)
          .then((r) => r.watched === true)
          .catch(() => false);
      }
      const wait = (watched ? WATCHED_MS : UNWATCHED_MS) - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  })();
  return {
    stop: async () => {
      on = false;
      await loop;
    },
  };
}
