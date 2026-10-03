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

Internal library `@momentum/runs`, used by the backend to execute runs.

| Module | Provides |
|---|---|
| session | `startSession`: one Claude Code process per run (Agent SDK), steerable, resumable, reports 5-hour/weekly usage %; `ask`: one tool-less turn on a chosen model |
| process | `spawnLimited`: process in a Windows job object with CPU/memory limits; `killTree` |
| git | Waits up to 5 s for a foreign lock; detached run checkout at the main line tip, no branches; `land`: the run's changes and own commits as one commit fast-forwarded or replayed onto the main line, conflicts take the run's side; `messageFile`; `workingTree` hash; `fileHistory`: commits of a file, newest first |
