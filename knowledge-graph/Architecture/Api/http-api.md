---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Component/api
    relation: exposed_by
  - to: Architecture/Dependency/contract
    relation: defined_by
artifacts:
  - apps/backend/src/api/http.ts
  - packages/contract/openapi.json
---
# HTTP API

Fastify routes of the back-end, described in `packages/contract/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back |
| Entities | GET /workspaces/{ws}/entities/*, /types, /search?q= |
| Chats, runs | GET, POST /workspaces/{ws}/chats; GET /runs/{id}; POST /runs/{id}/messages, /kill |
| Metrics | GET /workspaces/{ws}/metrics |
| Mapping | GET, PUT /workspaces/{ws}/mapping |
| Settings | GET, PUT /settings; GET /workspaces |

401 without a session (cookie or bearer token), errors as `{error}`; page loads get the web build.
