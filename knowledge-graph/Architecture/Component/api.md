---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/chat
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
  - apps/backend/src/auth.ts
  - apps/backend/src/momentum.ts
---
# API

The harness's single entry point: each capability is written once in the `Momentum` class and served as Fastify routes and as MCP tools at `/mcp` for voice tools.

- Auth: one scrypt password; 30-day session tokens stored hashed, bearer or cookie; only sign-in is public
- Feed: ranked items and counts; approve, send back (starts a chat run)
- Entities, types, search; chats, runs, messages, kill
- Metrics; graph build status, stop/start
- Settings: projects, feed size, cards, lifetimes, agents, models
- Reset: wipes a project and rebuilds its graph; 409 on conflict
- MCP only: `run_automation` on demand
- OpenAPI at `/openapi.json`; page loads get the web app
