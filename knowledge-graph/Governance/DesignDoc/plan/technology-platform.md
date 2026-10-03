---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
artifacts: []
---
# Technology: access, hosting and testing

- **Auth:** single user, generated or chosen password; session cookie on web, SecureStore on mobile, bearer token for MCP; API only on the Tailscale interface
- **Voice tools:** the API doubles as a streamable-HTTP MCP server at `/mcp`, plus `run_automation`
- **Machine:** this Windows 11 PC, root `C:\Projects`; back-end served at every logon by the `Momentum` scheduled task under the user's account; Tailscale, Claude Code CLI, Node 24, procgov; PlantUML server in Docker on port 8080
- **Mobile:** Android APK built locally and sideloaded; iPhone uses the web build as a PWA
- **Testing:** Vitest against `momentum_test`, Playwright for web, end-to-end on a throwaway copy of the harness
