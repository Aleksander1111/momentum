/** Tags are lower case, trimmed, with inner spaces turned into dashes: "Work Notes" and "work-notes" are one tag */
export function normaliseTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

/** The distinct tags of a list, normalised, in the order first seen */
export function distinctTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags.map(normaliseTag)) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** How many notes carry each tag, most used first, then by name */
export function tagCounts(notes: { tags: string[] }[]): { tag: string; notes: number }[] {
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, notes: count }))
    .sort((a, b) => b.notes - a.notes || a.tag.localeCompare(b.tag));
}
