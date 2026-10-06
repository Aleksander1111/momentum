---
type: Architecture/Service
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Infrastructure/Environment/dedicated-machine
    relation: runs_on
  - to: Data/Database/index-and-metrics-database
    relation: depends_on
  - to: Architecture/Dependency/contract
    relation: depends_on
  - to: Architecture/Dependency/entity
    relation: depends_on
  - to: Architecture/Dependency/kb
    relation: depends_on
  - to: Architecture/Dependency/runs
    relation: depends_on
artifacts:
  - apps/backend/src/app.ts
  - apps/backend/src/server.ts
  - apps/backend/src/cli.ts
  - apps/backend/service/install.ps1
  - apps/backend/service/serve.ps1
---
# Back-end

One Node process, `apps/backend`: API, orchestrator and consistency guard; only runs are separate processes. The "Momentum" scheduled task (`install.ps1`) serves it at every logon, hidden: `serve.ps1` waits for Postgres and runs `pnpm dev`, which restarts on every change on main.

- Fastify + zod, port 7300, Tailscale only; serves the web build
- On start: connects to Postgres, migrates the timeline onto the event bus, indexes the harness, materializes definitions, starts the orchestrator
- CLI `pnpm momentum` (passwords, enable, disable, logo, index, openapi) never orchestrates: enable/disable go through a running server's API, index marks it stale for one; errors exit 1
