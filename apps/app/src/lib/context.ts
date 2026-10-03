import { useSyncExternalStore } from 'react';
import type { ContextItem } from '@momentum/contract';

/**
 * Parts of cards the user added to the chat's context: quotes of selected text and picked diagram elements. They wait
 * as chips in the composer of their project and go with the next message sent there.
 */
let items: ContextItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const same = (a: ContextItem, b: ContextItem) =>
  a.workspace === b.workspace && a.path === b.path && a.quote === b.quote && a.element === b.element;

export const chatContext = {
  add(item: ContextItem) {
    if (items.some((i) => same(i, item))) return;
    items = [...items, item];
    emit();
  },
  remove(item: ContextItem) {
    items = items.filter((i) => !same(i, item));
    emit();
  },
  /** Taken once a message carried them */
  clear(workspace: string) {
    items = items.filter((i) => i.workspace !== workspace);
    emit();
  },
  of(workspace: string): ContextItem[] {
    return items.filter((i) => i.workspace === workspace);
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The context items waiting, of one project or of all */
export function useChatContext(workspace?: string | null): ContextItem[] {
  const all = useSyncExternalStore(subscribe, () => items, () => items);
  return workspace === undefined ? all : all.filter((i) => i.workspace === workspace);
}
