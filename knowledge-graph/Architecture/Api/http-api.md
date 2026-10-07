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

Fastify routes, contract zod; OpenAPI 3.0 at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, send-back, resolve, wont-resolve |
| Entities | …/entities/*, artifact/*, types, search, ask |
| Chats, runs | …/chats; /runs (under way), /runs/{id}, messages, kill |
| Projects | /workspaces; metrics, graph-build, reset, logo |
| Other | /timeline, /settings |

Public: POST /session, the document, web app. Every other route, judged by the matched route, not the raw URL, needs a session (bearer or cookie).

Refusals `{error}`: 400, 401, 404, 409; 503 rebuilding. Nullable enums list null. Sockets, `/mcp` undocumented.
