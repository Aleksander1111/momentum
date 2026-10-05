import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  const value = JSON.parse(text || '{}');
  if (value === null || typeof value !== 'object') throw new Error('body is not a JSON object');
  return value;
}

/** GET /books, GET /books/:id, POST /books */
export function createApp(store = createStore()) {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const match = pathname.match(/^\/books\/(\d+)$/);

    if (req.method === 'GET' && pathname === '/books') return send(res, 200, store.all());

    if (req.method === 'GET' && match) {
      const book = store.get(Number(match[1]));
      return book ? send(res, 200, book) : send(res, 404, { error: 'book not found' });
    }

    if (req.method === 'POST' && pathname === '/books') {
      let input;
      try {
        input = await readJson(req);
      } catch {
        return send(res, 400, { error: 'body must be JSON' });
      }
      if (typeof input.title !== 'string' || typeof input.author !== 'string') {
        return send(res, 400, { error: 'title and author are required' });
      }
      return send(res, 201, store.add(input));
    }

    send(res, 404, { error: 'not found' });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`bookshelf-api listening on http://localhost:${port}`));
}
