---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 3
references:
  - to: Harness/Automation/implementation
    relation: serves
artifacts:
  - packages/runs/package.json
  - packages/runs/src/index.ts
  - packages/runs/src/session.ts
  - packages/runs/src/process.ts
  - packages/runs/src/git.ts
---
# runs

Library `@momentum/runs`: how the backend executes runs.

| Module | Provides |
|---|---|
| session | `startSession`: one steerable, resumable Claude Code process per run; 5h/weekly usage % at start, end, mid-turn; `ask`: one tool-less turn |
| process | `spawnLimited`: procgov job (`-r`) with CPU/memory limits, commands stay in; env without `DATABASE_URL`, `PG*`, `MOMENTUM_*` (`MOMENTUM_RUN_DATABASE_URL` becomes `DATABASE_URL`); `killTree` |
| git | waits 5 s on a foreign lock; detached checkout at main tip; `land`: one commit, fast-forwarded or replayed, conflicts on the run's side; `nonLinear`: branches, detached HEAD, merges; `restorePath`: a path as a base has it; `fileHistory` |
