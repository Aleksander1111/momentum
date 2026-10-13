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
  - to: Architecture/Workflow/web-export-from-main
    relation: serves
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

One Node process, `apps/backend`, API, orchestrator, consistency guard; only runs, search answers, risk estimates run apart. The "Momentum" logon task (`install.ps1`) runs `serve.ps1`, which reruns `pnpm dev` when it exits; that restarts it on source changes and runs the [web export](Architecture/Workflow/web-export-from-main).

- `createMomentum` wires Postgres, workspaces, settings, bus, timeline, automations, embedder, guard, runner, approval, orchestrator, auth, voice
- Server: no password, no start; recovers runs, indexes the harness, materializes definitions, listens, starts orchestrator and voice
- CLI `pnpm momentum` (passwords, enable, disable, logo, index, openapi) uses the API
