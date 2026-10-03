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
| Entities | GET /workspaces/{ws}/entities/*, /artifact/*, /types, /search |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; GET …/metrics?range=; GET, PUT …/graph-build; POST …/reset |
| Settings | GET, PUT /settings |

`/artifact/*`: a file on the main line. Chats and messages carry card parts. Cookie or bearer, else 401; errors `{error}`. WebSockets `/voice`, `/voice/audio`; `/mcp`: voice tools.
