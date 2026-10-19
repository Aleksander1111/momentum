import { GraphSnapshot, type EntityDetail, type SearchResult } from '@momentum/contract';

/**
 * Web only: an export of the app carries one project's knowledge graph beside its page, for someone without Momentum.
 * The page loads `snapshot.js`, which sets the graph here before the app starts; the app then shows the Explorer alone,
 * answers its reads from the graph and reaches no server.
 */
declare global {
  var momentumSnapshot: unknown;
}

export const snapshot: GraphSnapshot | null =
  typeof globalThis.momentumSnapshot === 'undefined' ? null : GraphSnapshot.parse(globalThis.momentumSnapshot);

const entities = new Map((snapshot?.entities ?? []).map((e) => [e.path, e]));

export const snapshotEntity = (path: string): EntityDetail | null => entities.get(path) ?? null;

/** The entities whose title, path or text hold the words asked for, those holding more of them first */
export function snapshotSearch(q: string): SearchResult[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const results: SearchResult[] = [];
  for (const e of entities.values()) {
    const title = e.title.toLowerCase();
    const path = e.path.toLowerCase();
    const text = e.markdown.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      else if (path.includes(w)) score += 2;
      else if (text.includes(w)) score += 1;
    }
    if (score > 0) results.push({ ...e, score });
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 50);
}
