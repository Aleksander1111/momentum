---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 3
references:
  - to: Harness/Trigger/chat
    relation: starts
artifacts:
  - apps/backend/src/api/mcp.ts
  - apps/backend/src/api/http.ts
---
# Voice MCP API

The backend doubles as a stateless MCP server at `/mcp` (streamable HTTP, JSON responses, behind the same bearer or session cookie) so the user's voice tools reach every capability without the UI. Each tool wraps an API handler:

- **Feed:** `feed`, `approve`, `send_back` (comment starts a chat run)
- **Entities:** `workspaces`, `entity`, `types`, `search`
- **Runs:** `chats`, `chat`, `run_automation` (when its trigger allows on demand), `run`, `message`, `kill_run`
- **Knowledge graph:** `mapping`, `set_mapping`, `reset_project`
- **Admin:** `metrics`, `settings`, `update_settings` (projects, feed, cards, lifetimes, agents, models)
