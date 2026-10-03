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

The backend's interface: Fastify routes typed by `@momentum/contract` zod (OpenAPI at `/openapi.json`), voice sockets, and the same handlers as MCP tools at `/mcp`.

| Area | Routes |
|---|---|
| Session | POST, DELETE `/session` |
| Feed | `/feed`; approve, send back, resolve, won't resolve |
| Workspaces | entities, artifact, types, search, chats, metrics, graph-build, reset, logo |
| Runs | `/runs/:id`, messages, kill |
| Timeline | `/timeline` |
| Settings | GET, PUT `/settings` |
| Voice | `/voice`, `/voice/audio` |

- Sign-ins, refused sign-ins and sign-outs go on the timeline
- Cookie or bearer, else 401; page loads get the web build, 503 while it is rebuilt; errors `{error}`
