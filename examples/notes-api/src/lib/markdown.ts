import type { Note } from '../domain/note.js';

/** One note as a markdown section: its title as the heading, the tags as a line, then the body */
export function noteToMarkdown(note: Note): string {
  const tags = note.tags.length ? `\n_Tags: ${note.tags.map((t) => `#${t}`).join(' ')}_\n` : '';
  return `## ${note.title}\n${tags}\n${note.body.trim()}\n`;
}

/** Every note as one document, under a title, in the order given */
export function notesToMarkdown(notes: Note[], title = 'Notes'): string {
  return [`# ${title}\n`, ...notes.map(noteToMarkdown)].join('\n');
}
