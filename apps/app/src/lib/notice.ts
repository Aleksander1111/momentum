import { useSyncExternalStore } from 'react';

/** The last thing the app was refused, said once on whatever screen is open: a reaction the harness turned down, and why */
export interface Notice {
  id: number;
  text: string;
}

let current: Notice | null = null;
let next = 0;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function notify(text: string): void {
  current = { id: ++next, text };
  changed();
}

export function dismiss(id: number): void {
  if (current?.id !== id) return;
  current = null;
  changed();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useNotice(): Notice | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
