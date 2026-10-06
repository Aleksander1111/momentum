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

`@momentum/runs`: how the backend executes runs.

| Module | Provides |
|---|---|
| session | `startSession`: one steerable, resumable Claude Code process a run; 5h/weekly usage %; `ask`: one tool-less turn |
| process | `spawnLimited`: procgov job with CPU/memory limits; env without `DATABASE_URL`, `PG*`, `MOMENTUM_*` (`MOMENTUM_RUN_DATABASE_URL` becomes `DATABASE_URL`); `killTree` |
| git | waits 5 s on locks; detached checkout at main tip; run's changes read as stored (`autocrlf=input`); `land`: one commit, fast-forward or replay, conflicts: run's side; `nonLinear`: detached HEAD, other branches, merges; `restorePath`; `fileHistory` |
