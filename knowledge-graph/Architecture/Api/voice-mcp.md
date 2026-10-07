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

`/mcp`: the API's handlers as stateless MCP (streamable HTTP) for voice tools; session needed; not in the OpenAPI document.

- **Feed:** `feed`, `approve`, `send_back` (comment: a chat run), `resolve_issue` (option or own text, via a chat run), `wont_resolve_issue`
- **Entities:** `workspaces`, `entity`, `types`, `search`, `ask`
- **Runs:** `chats`, `chat`, `run_automation` (one entity: `target_path`), `active_runs` (under way), `run`, `message`, `kill_run`
- **Timeline:** `timeline`: what came of runs, newest first, by workspace or actor, paged by `before`, 50 a page
- **Graph build:** `graph_build`, `set_graph_build`, `reset_project`
- **Admin:** `metrics`, `settings`, `update_settings`
