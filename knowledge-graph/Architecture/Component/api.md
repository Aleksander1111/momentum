---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/backend
    relation: part_of
  - to: Architecture/Component/attention-feed
    relation: serves
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
  - apps/backend/src/momentum.ts
  - apps/backend/src/auth.ts
---
# API

Entry point between the front-end and the harness, `apps/backend/src/api`. Every capability lives once in the `Momentum` class and is exposed twice: as HTTP routes and as MCP tools at `/mcp` (streamable HTTP) for the user's voice tools.

- Single user: password set at install, 30-day session tokens stored hashed; cookie or bearer token on every route except sign-in
- Feed, approve, send back; entities, types, search; chats, runs, messages, kill; metrics; mapping; settings
- OpenAPI generated from the zod schemas at `/openapi.json`
- Polling only: no push channel
