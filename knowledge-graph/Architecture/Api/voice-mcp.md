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

`/mcp`: the API's handlers as a stateless MCP server (streamable HTTP) for voice tools; signed in, not in the OpenAPI document.

- **Feed:** `feed`, `approve`, `send_back` (comment: a chat run), `resolve_issue` (option or own text, applied by a chat run), `wont_resolve_issue`
- **Entities:** `workspaces`, `entity`, `types`, `search`, `ask`
- **Runs:** `chats`, `chat`, `run_automation` (one entity via `target_path`), `run`, `message`, `kill_run`
- **Timeline:** `timeline`, newest first, by workspace or actor, paged by `before`, 50 by default
- **Graph build:** `graph_build`, `set_graph_build`, `reset_project`
- **Admin:** `metrics`, `settings`, `update_settings`
