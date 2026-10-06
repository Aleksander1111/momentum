import { createServer, type Server } from 'node:http';
import { HttpError, send } from './lib/http.js';
import { Router } from './router.js';
import { healthRoutes } from './routes/health.js';
import { noteRoutes } from './routes/notes.js';
import { tagRoutes } from './routes/tags.js';
import { createMemoryStore, sampleNotes } from './store/memory.js';
import type { Store } from './store/store.js';

export const VERSION = '0.3.0';

/** The API over a store; tests pass a fresh store and listen on a free port */
export function createApp(store: Store = createMemoryStore(sampleNotes)): Server {
  const router = new Router();
  healthRoutes(router, VERSION);
  noteRoutes(router, store);
  tagRoutes(router, store);

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = router.match(req.method ?? 'GET', url.pathname);
    try {
      if (!match) {
        const known = router.knows(url.pathname);
        throw new HttpError(known ? 405 : 404, known ? 'method not allowed' : 'not found');
      }
      await match.handler({ req, res, params: match.params, query: url.searchParams });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.details === undefined ? {} : { details: e.details }) });
      console.error(e);
      send(res, 500, { error: 'internal error' });
    }
  });
}
