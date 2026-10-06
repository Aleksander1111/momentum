# notes-api

A small HTTP API for keeping notes: each note has a title, a body and tags. Notes can be listed by tag,
searched by their words and exported as one markdown document.

Written in TypeScript on `node:http`; request bodies are validated with [zod](https://zod.dev) at the
edge, and everything is kept in memory (see `docs/decisions/001-in-memory-store.md`).

## Running

```sh
npm ci
npm start            # listens on http://localhost:3000, PORT to change it
```

## Checks

```sh
npm run typecheck    # tsc --noEmit
npm test             # node --test over test/*.test.ts, run through tsx
```

## Routes

See `docs/api.md`.
