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
  - to: Harness/Automation/search
    relation: concerns
artifacts:
  - apps/backend/src/api/http.ts
  - packages/contract/openapi.json
---
# HTTP API

Fastify routes typed by contract zod; OpenAPI 3.0 at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE (204) /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back, /resolve, /wont-resolve |
| Entities | GET /workspaces/{ws}/entities/*, artifact/*, types, search; POST …/ask |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; …/metrics, graph-build, reset, logo |
| Timeline | GET /timeline, filtered, paged |
| Settings | GET, PUT /settings |

Routes declare refusals `{error}`: 400, 401, 404, 409; 503 mid-rebuild. Card and type-tree schemas named; nullable enums list null. Sockets, `/mcp`: undocumented.
