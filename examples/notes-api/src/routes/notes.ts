import { NoteInput, NotePatch } from '../domain/note.js';
import { normaliseTag } from '../domain/tag.js';
import { HttpError, readJson, send } from '../lib/http.js';
import { notesToMarkdown } from '../lib/markdown.js';
import type { Router } from '../router.js';
import { search } from '../search.js';
import type { Store } from '../store/store.js';

const idOf = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'id must be a positive integer');
  return id;
};

/** The notes a listing or export covers: by tag, by query, or all */
function select(store: Store, query: URLSearchParams) {
  let notes = store.all();
  const tag = query.get('tag');
  if (tag) notes = notes.filter((n) => n.tags.includes(normaliseTag(tag)));
  const q = query.get('q');
  if (q) notes = search(notes, q);
  return notes;
}

export function noteRoutes(router: Router, store: Store): void {
  // GET /notes, ?tag= keeps one tag's notes, ?q= searches them
  router.on('GET', '/notes', ({ res, query }) => send(res, 200, select(store, query)));

  router.on('GET', '/notes/:id', ({ res, params }) => {
    const note = store.get(idOf(params.id!));
    if (!note) throw new HttpError(404, 'note not found');
    send(res, 200, note);
  });

  router.on('POST', '/notes', async ({ req, res }) => {
    const parsed = NoteInput.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, 'invalid note', parsed.error.issues);
    send(res, 201, store.add(parsed.data));
  });

  router.on('PATCH', '/notes/:id', async ({ req, res, params }) => {
    const parsed = NotePatch.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, 'invalid note', parsed.error.issues);
    const note = store.update(idOf(params.id!), parsed.data);
    if (!note) throw new HttpError(404, 'note not found');
    send(res, 200, note);
  });

  router.on('DELETE', '/notes/:id', ({ res, params }) => {
    if (!store.remove(idOf(params.id!))) throw new HttpError(404, 'note not found');
    res.writeHead(204);
    res.end();
  });

  // GET /export, ?tag= and ?q= as on the listing: one markdown document
  router.on('GET', '/export', ({ res, query }) => {
    const tag = query.get('tag');
    send(res, 200, notesToMarkdown(select(store, query), tag ? `Notes tagged #${normaliseTag(tag)}` : 'Notes'), 'text/markdown');
  });
}
