---
type: Infrastructure/Environment
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 2
references: []
artifacts:
  - apps/backend/service/momentum.xml
  - apps/backend/src/config.ts
---
# Dedicated machine

The one self-hosted, resource-rich machine that runs the back-end, the runs and the knowledge base: this PC, Windows 11, workspaces root `C:Projects`.

- Every git repository directly under the root is a workspace; run checkouts live under `C:Projects.runs`
- Tailscale: the API listens only on the tailnet address, port 7300; no port on the public internet
- Node 24, pnpm, Claude Code CLI, Docker with Postgres 18 + pgvector; procgov caps each run (4 GB, 4 cores by default)
- Back-end as the Windows service "Momentum" (WinSW) under the user's account: starts after Tailscale, restarts on failure
- Password in `C:Projects.momentumpassword.txt`
