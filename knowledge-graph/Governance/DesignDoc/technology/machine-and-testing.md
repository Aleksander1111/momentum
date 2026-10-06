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
- **Service:** the `Momentum` scheduled task serves the back-end at every logon; `serve.ps1` runs `pnpm dev` hidden, restarting on every change on main
- **Package 0:** Momentum task, Tailscale, Claude Code CLI, Node 24, procgov
- **Docker:** Postgres + pgvector; PlantUML server (port 8080)
- **Testing:** Vitest over entity, kb, runs and the back-end's rules, on scratch databases; end-to-end in Firefox, a world per scenario: copies of its example projects, a harness workspace of definitions and types only, own database and back-end

Assumed: procgov limits hold for the Claude Code subprocess tree.
