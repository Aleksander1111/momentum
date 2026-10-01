---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references: []
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
  - apps/backend/src/momentum.ts
  - apps/backend/src/auth.ts
---
# API

Entry point between the front-end and the harness, `apps/backend/src/api`. Every capability lives once in the `Momentum` class and is exposed twice: as HTTP routes and as MCP tools at `/mcp` for the user's voice tools.

- Single user: password, 30-day hashed session tokens; cookie or bearer except on sign-in
- Feed with entity counts by verification and sync state; approve, send back
- Entities, types, search; chats, runs, messages, kill; metrics; mapping; settings
- Project reset (`POST /workspaces/{ws}/reset`, `reset_project`): wipes entities, rebuilds the graph; 409 for the harness
- OpenAPI from zod schemas at `/openapi.json`; page loads get the web app
- Polling only: no push channel
