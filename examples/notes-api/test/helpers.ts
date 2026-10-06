import type { Server } from 'node:http';
import type { NoteInput } from '../src/domain/note.js';
import { createApp } from '../src/server.js';
import { createMemoryStore, sampleNotes } from '../src/store/memory.js';

export interface Api {
  server: Server;
  base: string;
  request(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown; text: string; type: string }>;
  close(): Promise<void>;
}

/** The app on a free port with a fresh store, seeded unless told otherwise */
export async function start(seed: NoteInput[] = sampleNotes): Promise<Api> {
  const server = createApp(createMemoryStore(seed, new Date('2024-01-01T00:00:00Z')));
  await new Promise<void>((ok) => server.listen(0, ok));
  const address = server.address();
  const base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
  return {
    server,
    base,
    async request(method, path, body) {
      const init: RequestInit = { method };
      if (body !== undefined) {
        init.headers = { 'content-type': 'application/json' };
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const res = await fetch(`${base}${path}`, init);
      const text = await res.text();
      const type = res.headers.get('content-type') ?? '';
      const json = type.includes('json') && text ? JSON.parse(text) : null;
      return { status: res.status, json, text, type };
    },
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}
