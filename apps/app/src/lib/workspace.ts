import { useEffect, useSyncExternalStore } from 'react';
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

/** The names of the enabled workspaces: the only ones shown anywhere but Settings */
export function useEnabledWorkspaces(): string[] {
  const { data } = useWorkspaces();
  return (data ?? []).filter((w) => w.enabled).map((w) => w.name);
}

/** The chosen workspace, defaulting to the first enabled one; only enabled ones can be chosen. */
export function useCurrentWorkspace(): [string | null, (ws: string) => void, string[]] {
  const chosen = useSyncExternalStore(subscribe, () => current, () => current);
  const names = useEnabledWorkspaces();
  const shown = chosen && names.includes(chosen) ? chosen : (names[0] ?? null);
  // An enabled project shown when none was chosen stays chosen: another one enabled later does not take its place
  const keep = !chosen && !!shown;
  useEffect(() => {
    if (keep && shown) setCurrentWorkspace(shown);
  }, [keep, shown]);
  return [shown, setCurrentWorkspace, names];
}
