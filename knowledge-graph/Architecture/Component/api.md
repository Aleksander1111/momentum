---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
  - apps/backend/src/auth.ts
  - apps/backend/src/momentum.ts
---
# API

The harness's single entry point in `apps/backend/src/api`: each capability is written once in the `Momentum` class and served as Fastify routes and as MCP tools at `/mcp` for voice tools.

- Auth: one scrypt password; 30-day session tokens stored hashed, bearer or cookie; only sign-in is public
- Feed: ranked items and entity counts by state; approve, send back (starts a chat run)
- Entities, types, search; chats, runs, messages, kill
- Metrics, mapping start/stop, settings
- Reset: wipes a project and rebuilds its graph; 409 on conflict
- MCP only: `run_automation` on demand
- OpenAPI at `/openapi.json`; page loads get the web app
