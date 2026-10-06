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
  - apps/backend/package.json
  - apps/backend/tsconfig.json
  - apps/backend/src/app.ts
  - apps/backend/src/server.ts
  - apps/backend/src/cli.ts
  - apps/backend/service/install.ps1
  - apps/backend/service/serve.ps1
---
# Back-end

One Node process, `apps/backend`: API, orchestrator and consistency guard; runs, search answers and risk estimates are the only separate processes. The "Momentum" scheduled task (`install.ps1`) serves it at every logon: `serve.ps1` runs `pnpm dev`, restarted on every change on main.

- `createMomentum` wires Postgres, workspaces, settings, bus, timeline, automations, embedder, guard, runner, approval, orchestrator, auth, voice
- Server: no password, no start; recovers runs, indexes the harness first, materializes definitions, listens, starts orchestrator and voice
- CLI `pnpm momentum` (passwords, enable, disable, logo, index, openapi) goes through the server's API
