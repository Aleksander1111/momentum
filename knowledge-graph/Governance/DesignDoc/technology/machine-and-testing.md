---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Governance/DesignDoc/plan/technology-platform
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Machine and testing

- **Machine:** this Windows 11 PC, workspaces root `C:\Projects`
- **Service:** the `Momentum` scheduled task serves the back-end at every logon; `serve.ps1` waits for Postgres and runs `pnpm dev` hidden under the user's account (its Claude Code login and git identity), restarting on every change on main
- **Package 0:** Momentum scheduled task, Tailscale, Claude Code CLI, Node 24, procgov; this repository as the first workspace
- **Testing:** Vitest (parser, guard, hooks, ranking, orchestrator) against `momentum_test`; Playwright for web; end-to-end on a throwaway copy of the harness repository and database

Assumed: procgov limits hold for the Claude Code subprocess tree.
