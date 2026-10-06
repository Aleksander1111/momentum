# 2. Validate request bodies with zod at the edge

Accepted, 2024-02.

Request bodies are parsed with zod schemas (`src/domain/note.ts`) in the route handlers; inside, the code trusts
its types. Tags are normalised in the schema's transform so every path that takes tags agrees on their shape.
