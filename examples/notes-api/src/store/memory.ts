import type { Note, NoteInput, NotePatch } from '../domain/note.js';
import { nextId } from '../lib/id.js';
import type { Store } from './store.js';

/** A few notes to start with, so the API answers something before the first POST */
export const sampleNotes: NoteInput[] = [
  { title: 'Standup', body: 'Mondays at 10:00, in the small room.', tags: ['work', 'meetings'] },
  { title: 'Groceries', body: 'Milk, bread, coffee beans.', tags: ['home'] },
  { title: 'Reading list', body: 'Designing Data-Intensive Applications; A Philosophy of Software Design.', tags: ['books', 'work'] },
];

/** Notes kept in memory: everything is gone when the process ends */
export function createMemoryStore(seed: NoteInput[] = [], now = new Date()): Store {
  const stamp = now.toISOString();
  const notes: Note[] = seed.map((input, i) => ({ id: i + 1, ...input, createdAt: stamp, updatedAt: stamp }));
  return {
    all: () => notes.map((n) => ({ ...n, tags: [...n.tags] })),
    get: (id) => notes.find((n) => n.id === id),
    add(input, at = new Date()) {
      const note: Note = { id: nextId(notes), ...input, createdAt: at.toISOString(), updatedAt: at.toISOString() };
      notes.push(note);
      return note;
    },
    update(id, patch, at = new Date()) {
      const i = notes.findIndex((n) => n.id === id);
      if (i < 0) return undefined;
      const current = notes[i]!;
      const note: Note = {
        ...current,
        title: patch.title ?? current.title,
        body: patch.body ?? current.body,
        tags: patch.tags ?? current.tags,
        updatedAt: at.toISOString(),
      };
      notes[i] = note;
      return note;
    },
    remove(id) {
      const i = notes.findIndex((n) => n.id === id);
      if (i < 0) return false;
      notes.splice(i, 1);
      return true;
    },
  };
}
