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

Fastify routes typed by contract zod; OpenAPI at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back, /resolve, /wont-resolve |
| Entities | GET /workspaces/{ws}/entities/*, artifact/*, types, search; POST …/ask |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; …/metrics, graph-build, reset, logo |
| Timeline | GET /timeline, filtered, paged |
| Settings | GET, PUT /settings |

Approve, resolve carry the card version shown. Errors `{error}`: 401, 404, 409 conflict; 503 mid-rebuild. Sockets `/voice`, `/voice/audio`; `/mcp`: voice tools.
