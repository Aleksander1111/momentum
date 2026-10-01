---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references: []
artifacts:
  - docs/PLAN.md
---
# Machine and testing

- **Machine:** this Windows 11 PC, workspaces root `C:\Projects`
- **Service:** back-end as a Windows service (WinSW, config in `apps/backend/service/`) under the user's account, for its Claude Code login and git identity
- **Installed:** Tailscale for Windows, Claude Code CLI, Node 24 from the Node.js installer, procgov from winget
- **Testing:** Vitest for parser, guard, hooks, ranking and orchestrator against a separate `momentum_test` database; Playwright for the web app; end-to-end on a throwaway copy of the harness repository and database, so the harness manages itself

Assumed, not verified: procgov limits hold for the Claude Code subprocess tree.
