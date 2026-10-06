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

The backend's interface: Fastify routes typed by contract zod, documented at `/openapi.json`; voice sockets; MCP tools at `/mcp`.

| Area | Routes |
|---|---|
| Session | `/session` |
| Feed | `/feed`; approve, send back, (won't) resolve |
| Workspaces | entities, artifacts, types, search, ask, chats, metrics, graph build, reset, logo |
| Runs | `/runs/:id`, messages, kill |
| Other | `/timeline`, `/settings`, `/voice`, `/voice/audio` |

- Sign-ins, refusals, sign-outs: on the timeline
- Refusals `{error}`: 400, 401, 404, 409 (stale approve, resolve)
- Document: card and type-tree schemas named; nullable enums list null
- Pages get the web app, 503 mid-rebuild
