---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Machine and testing

- **Machine:** this Windows 11 PC, workspaces under `C:\Projects`
- **Service:** back-end as a Windows service (WinSW) under the user's account, for its Claude Code login and git identity
- **Installed:** Tailscale, Claude Code CLI, Node 24, procgov from winget
- **Testing:** Vitest for parser, guard, hooks, ranking and orchestrator against `momentum_test`; Playwright for the web app; end-to-end on a throwaway copy of harness repo and database

Assumed, not verified: procgov limits hold for the Claude Code subprocess tree.
