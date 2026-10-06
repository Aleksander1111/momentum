---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references: []
artifacts: []
---
# Machine and testing

- **Machine:** this Windows 11 PC, workspaces root `C:\Projects`
- **Service:** the `Momentum` scheduled task serves the back-end at every logon; `serve.ps1` waits for Postgres and runs `pnpm dev` hidden under the user's account, restarting on every change on main
- **Package 0:** Momentum task, Tailscale, Claude Code CLI, Node 24, procgov; this repository as first workspace
- **Docker:** Postgres + pgvector; PlantUML server (port 8080)
- **Testing:** Vitest (parser, guard, hooks, ranking, orchestrator) against `momentum_test`; Playwright for web; end-to-end on a throwaway copy of the harness repository and database

Assumed: procgov limits hold for the Claude Code subprocess tree.
