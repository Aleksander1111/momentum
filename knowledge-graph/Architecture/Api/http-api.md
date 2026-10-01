---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references: []
artifacts:
  - apps/backend/src/api/http.ts
  - packages/contract/openapi.json
---
# HTTP API

Fastify routes, zod schemas from `@momentum/contract`, served at `/openapi.json`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back |
| Entities | GET /workspaces/{ws}/entities/*, /types, /search?q= |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; GET …/metrics; GET, PUT …/mapping; POST …/reset |
| Settings | GET, PUT /settings |

Metrics give each automation's runs, failures, average time and share of 5-hour and weekly usage. Cookie or bearer session, else 401; errors as `{error}` (400, 404, 409). `/mcp` serves voice tools.
