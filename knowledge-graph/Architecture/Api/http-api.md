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
| Feed | GET /feed; POST /feed/{path}/approve, /send-back |
| Entities | GET /workspaces/{ws}/entities/*, /types, /search?q= |
| Chats, runs | GET, POST …/chats; GET /runs/{id}; POST …/messages, /kill |
| Projects | GET /workspaces; GET …/metrics; GET, PUT …/graph-build; POST …/reset |
| Settings | GET, PUT /settings (models, summarization, lifetimes…) |

Cookie or bearer session, else 401; errors `{error}` (400/404/409). `/mcp` serves voice tools; HTML page loads get the web app.
