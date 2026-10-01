---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references: []
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
---
# API

The backend's interface: a Fastify HTTP API typed by `@momentum/contract` (zod, OpenAPI at `/openapi.json`) and the same handlers as MCP tools at `/mcp` for voice tools.

| Area | Routes |
|---|---|
| Session | POST/DELETE `/session` (password → cookie or bearer token) |
| Feed | `/feed`, approve, send-back |
| Workspaces | entities, types, search, chats, metrics, graph-build, reset |
| Runs | `/runs/:id`, messages, kill |
| Settings | GET/PUT `/settings` |

- Every API route but sign-in needs a session
- Serves the web app build for page loads and unknown GETs
- Errors map to 400/404/409/500
- MCP adds `run_automation`
