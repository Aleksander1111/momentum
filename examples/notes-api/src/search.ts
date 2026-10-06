import type { Note } from './domain/note.js';

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Notes matching every word of the query, best first: a word in the title counts three, in a tag two, in the body
 * one. A note missing any word of the query is left out.
 */
export function search(notes: Note[], query: string): Note[] {
  const terms = words(query);
  if (terms.length === 0) return notes;
  const scored = notes.flatMap((note) => {
    const title = words(note.title);
    const body = words(note.body);
    let score = 0;
    for (const term of terms) {
      const inTitle = title.some((w) => w.startsWith(term));
      const inTag = note.tags.some((t) => t.includes(term));
      const inBody = body.some((w) => w.startsWith(term));
      if (!inTitle && !inTag && !inBody) return [];
      score += (inTitle ? 3 : 0) + (inTag ? 2 : 0) + (inBody ? 1 : 0);
    }
    return [{ note, score }];
  });
  return scored.sort((a, b) => b.score - a.score || a.note.id - b.note.id).map((s) => s.note);
}
