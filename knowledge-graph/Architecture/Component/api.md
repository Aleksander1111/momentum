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

The entry point between the front-end and the harness, in `apps/backend/src/api`. Each capability is written once in the `Momentum` class and served two ways: as Fastify routes and as MCP tools at `/mcp` for voice tools.

- Single user: scrypt password, 30-day session tokens stored hashed; bearer or cookie on every call except sign-in
- Feed: ranked items and entity counts by state; approve, send back
- Entities, types, search; chats, runs, messages, kill; metrics; mapping; settings
- Reset: wipes a project and rebuilds its graph; returns 409 for the harness
- MCP only: `run_automation` starts an automation on demand
- OpenAPI at `/openapi.json`; page loads get the web app; polling only
