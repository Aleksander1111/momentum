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

Fastify routes typed by `@momentum/contract` zod schemas, published at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back |
| Entities | GET /workspaces/{ws}/entities/*, /types, /search?q= |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; GET …/metrics; GET, PUT …/graph-build; POST …/reset |
| Settings | GET, PUT /settings |

Graph build reports state, coverage, estimate and usage. Cookie or bearer session, else 401; errors as `{error}`. `/mcp` serves voice tools.
