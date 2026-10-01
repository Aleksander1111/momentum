---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Component/api
    relation: exposed_by
  - to: Architecture/Api/http-api
    relation: mirrors
artifacts:
  - apps/backend/src/api/mcp.ts
---
# Voice MCP surface

The API doubled as an MCP server over streamable HTTP at `/mcp`, behind the same session, so the harness can be driven by the user's voice tools without the UI.

- The same handlers as the HTTP routes: workspaces, feed, approve, send_back, entity, types, search, chats, chat, run, message, kill_run, mapping, set_mapping, metrics, settings, update_settings
- Plus `run_automation`: start an automation on demand where its trigger allows it
- Stateless: a server and transport per request
