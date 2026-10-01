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
  - apps/backend/service/momentum.xml
---
# Back-end

One Node process, `apps/backend`: the API, the orchestrator and the consistency guard together, with only the runs as separate processes. Runs as the Windows service "Momentum" under the user's account, after Tailscale.

- Fastify + zod, port 7300, listening only on the Tailscale interface
- Serves the web build of the app on page loads
- On start: connects to Postgres, indexes the harness workspace first, materializes definitions into enabled workspaces, then starts the orchestrator
- CLI `pnpm momentum`: generate-password, set-password, enable, disable, index, openapi
