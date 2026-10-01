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

Fastify routes of the back-end, zod schemas from `@momentum/contract`.

| Area | Routes |
|---|---|
| Session | POST, DELETE /session |
| Feed | GET /feed; POST /feed/{path}/approve, /send-back |
| Entities | GET /workspaces/{ws}/entities/*, /types, /search?q= |
| Chats, runs | GET, POST /workspaces/{ws}/chats; GET /runs/{id}; POST /runs/{id}/messages, /kill |
| Projects | GET /workspaces; GET /workspaces/{ws}/metrics; GET, PUT …/mapping; POST …/reset |
| Settings | GET, PUT /settings |

Cookie or bearer session, else 401; errors as `{error}` (400, 404, 409 on resetting the harness). `/mcp` serves the voice tools; page loads get the web build. `openapi.json` still lacks `/reset`.
