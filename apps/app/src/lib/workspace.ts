import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// The workspace chosen in Explorer and Metrics; shared so both pages open on the same one.
let current: string | null = null;
const listeners = new Set<() => void>();

export function setCurrentWorkspace(ws: string) {
  current = ws;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useWorkspaces() {
  return useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces });
}

/** The chosen workspace, defaulting to the first enabled one. */
export function useCurrentWorkspace(): [string | null, (ws: string) => void, string[]] {
  const chosen = useSyncExternalStore(subscribe, () => current, () => current);
  const { data } = useWorkspaces();
  const names = (data ?? []).map((w) => w.name);
  const fallback = (data ?? []).find((w) => w.enabled)?.name ?? names[0] ?? null;
  return [chosen && names.includes(chosen) ? chosen : fallback, setCurrentWorkspace, names];
}
