---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Trigger/chat
    relation: starts
  - to: Harness/Automation/graph-build
    relation: controls
artifacts:
  - apps/backend/src/api/http.ts
  - apps/backend/src/api/mcp.ts
---
# Voice MCP API

The backend is also a stateless MCP server at `/mcp` (streamable HTTP, JSON responses, same bearer or session cookie), so the user's voice tools reach every capability without the UI. Each tool wraps an API handler:

- **Feed:** `feed`, `approve`, `send_back` (comment starts a chat run)
- **Entities:** `workspaces`, `entity`, `types`, `search`
- **Runs:** `chats`, `chat`, `run_automation` (when its trigger allows on demand), `run`, `message`, `kill_run`
- **Knowledge graph:** `graph_build`, `set_graph_build` (stop or restart), `reset_project`
- **Admin:** `metrics`, `settings`, `update_settings`
