---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 3
references:
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
---
# API

The backend's interface: Fastify routes typed by `@momentum/contract` zod schemas (OpenAPI at `/openapi.json`), voice sockets, and the same handlers as MCP tools at `/mcp`.

| Area | Routes |
|---|---|
| Session | POST, DELETE `/session` |
| Feed | `/feed`; approve, send back, resolve an issue, won't resolve |
| Workspaces | entities, artifact, types, search, chats, metrics, graph-build, reset, logo |
| Runs | `/runs/:id`, messages, kill |
| Settings | GET, PUT `/settings` |
| Voice | `/voice` control, `/voice/audio` per recording |

- Artifact: a repository file on the main line
- Session by cookie or bearer; all but sign-in need one (401)
- Page loads get the web build; errors `{error}`
