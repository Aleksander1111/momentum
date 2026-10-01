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
  - to: Harness/Automation/graph-build
    relation: controls
artifacts:
  - apps/backend/src/api/mcp.ts
  - apps/backend/src/api/http.ts
---
# Voice MCP API

The backend doubles as a stateless MCP server at `/mcp` (streamable HTTP, JSON responses, a server per request) so the user's voice tools reach every capability without the UI. Each tool wraps an API handler:

- **Feed:** `feed`, `approve`, `send_back` (comment starts a chat run)
- **Entities:** `workspaces`, `entity`, `types`, `search`
- **Runs:** `chats`, `chat`, `run_automation` (when its trigger allows on demand), `run`, `message`, `kill_run`
- **Graph build:** `graph_build`, `set_graph_build` (stop or restart), `reset_project`
- **Admin:** `metrics` (range 24h, 7d or 30d; default 30d), `settings`, `update_settings`
