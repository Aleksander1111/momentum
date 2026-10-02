---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 3
references:
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
---
# API

The backend's interface: Fastify routes typed by `@momentum/contract` zod schemas (OpenAPI at `/openapi.json`), and the same handlers as MCP tools at `/mcp` for voice tools.

| Area | Routes |
|---|---|
| Session | POST, DELETE `/session` |
| Feed | `/feed`; approve, send back, resolve an issue (option or own text), won't resolve |
| Workspaces | entities, types, search, chats, metrics (`range`, 30d default), graph-build, reset |
| Runs | `/runs/:id`, messages, kill |
| Settings | GET, PUT `/settings` |

- Session by cookie or bearer token; every API route but sign-in needs one (401)
- Page loads get the web build
- Errors as `{error}`: 400/404/409/500
- MCP adds `run_automation`
