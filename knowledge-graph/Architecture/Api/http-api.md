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

Fastify routes typed by `@momentum/contract` zod; OpenAPI at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back, /resolve, /wont-resolve |
| Entities | GET /workspaces/{ws}/entities/*, /artifact/*, /types, /search |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; …/metrics?range=; GET, PUT …/graph-build; POST …/reset; PUT, DELETE …/logo |
| Timeline | GET /timeline?workspace, actor, before, limit → events, next |
| Settings | GET, PUT /settings |

Cookie or bearer, else 401. WebSockets `/voice`, `/voice/audio`; `/mcp`: voice tools.
