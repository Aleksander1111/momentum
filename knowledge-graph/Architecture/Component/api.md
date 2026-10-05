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

The backend's interface: Fastify routes typed by contract zod (OpenAPI `/openapi.json`), voice sockets, handlers as MCP tools at `/mcp`.

| Area | Routes |
|---|---|
| Session | `/session` |
| Feed | `/feed`; approve, send back, (won't) resolve |
| Workspaces | entities, artifacts, types, search, ask, chats, metrics, graph build, reset, logo |
| Runs | `/runs/:id`, messages, kill |
| Other | `/timeline`, `/settings`, `/voice`, `/voice/audio` |

- Sign-ins, refusals, sign-outs: on the timeline
- Approve, resolve carry the version shown; conflicts: 409
- `ask` answers from the entities found; MCP `run_automation` takes a target
- Cookie or bearer, else 401; pages: web app, 503 mid-rebuild
