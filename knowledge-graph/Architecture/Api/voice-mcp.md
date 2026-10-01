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

`/mcp` serves the API's handlers as a stateless MCP server (streamable HTTP, JSON responses, a server per request), so voice tools reach every capability without the UI:

- **Feed:** `feed`, `approve`, `send_back` (comment starts a chat run)
- **Entities:** `workspaces`, `entity`, `types`, `search`
- **Runs:** `chats`, `chat`, `run_automation` (if its trigger allows on demand), `run`, `message`, `kill_run`
- **Graph build:** `graph_build`, `set_graph_build` (stop or restart), `reset_project`
- **Admin:** `metrics` (optional range), `settings`, `update_settings`
