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
  - apps/backend/src/export.ts
  - apps/backend/src/zip.ts
  - apps/backend/service/install.ps1
  - apps/backend/service/serve.ps1
---
# Back-end

One Node process, `apps/backend`: API, orchestrator, guard; runs, search, risk estimates apart. `install.ps1` sets a logon task, `serve.ps1`, rerunning `pnpm dev`: a commit to its sources restarts it and runs the [web export](Architecture/Workflow/web-export-from-main).

- `createMomentum` wires Postgres, workspaces, settings, bus, timeline, automations, embedder, guard, runner, approval, orchestrator, auth, voice
- Server: no password, no start; recovers runs, indexes harness, materializes, listens, starts orchestrator, voice
- CLI `pnpm momentum` (passwords, enable [--full: whole graph], disable, logo, index, export-graph, openapi) calls the API over node:http, as two fetches crash Node on exit on Windows
- `export-graph <workspace> [zip]` (`export.ts`, `zip.ts`): the served web app with the project's graph in `snapshot.js` before its page, the page's addresses made relative and allowed from `file:`, zipped without a dependency; its `index.html` opens from the file in any browser, for someone without Momentum
