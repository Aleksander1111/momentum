---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - apps/backend/src/api/http.ts
  - packages/contract/openapi.json
---
# HTTP API

Fastify routes typed by `@momentum/contract` zod schemas; OpenAPI at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back, /resolve, /wont-resolve |
| Entities | GET /workspaces/{ws}/entities/*, /types, /search |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; GET …/metrics?range=; GET, PUT …/graph-build; POST …/reset |
| Settings | GET, PUT /settings |

New chats and messages carry card parts as context. Feed items and entities carry card diffs. Send back, resolve return a run id. Cookie or bearer, else 401; errors `{error}`. `/mcp`: voice tools.
