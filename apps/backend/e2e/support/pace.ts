import { OBSERVER } from '../observer/post.ts';
import { guarded } from './usage.ts';

/**
 * Asks the observer before an action in the app or a step: held while the observer is paused (Next lets one through),
 * then the delay set there, so a person can follow what the scenario does. Without an observer it goes at once.
 */
export async function pace(kind: 'action' | 'step', label: string): Promise<void> {
  for (;;) {
    guarded();
    const r = await fetch(`${OBSERVER}/gate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, label }) })
      .then((x) => x.json() as Promise<{ go: boolean; delayMs: number }>)
      .catch(() => ({ go: true, delayMs: 0 }));
    if (r.go) {
      if (r.delayMs) await new Promise((ok) => setTimeout(ok, r.delayMs));
      return;
    }
    await new Promise((ok) => setTimeout(ok, 300));
  }
}
