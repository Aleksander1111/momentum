/** Ids count up from the highest one in use, so a removed note's id is never reused within a run */
export function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
}
