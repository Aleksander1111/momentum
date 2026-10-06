import type { Note, NoteInput, NotePatch } from '../domain/note.js';

/** Where notes live; one implementation for now, in memory */
export interface Store {
  all(): Note[];
  get(id: number): Note | undefined;
  add(input: NoteInput, now?: Date): Note;
  update(id: number, patch: NotePatch, now?: Date): Note | undefined;
  remove(id: number): boolean;
}
