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
| session | `startSession`: one Claude Code process per run (Agent SDK), steerable, resumable; 5-hour/weekly usage % at start, end and mid-turn; `ask`: one tool-less turn |
| process | `spawnLimited`: in a procgov job (`-r`) with CPU/memory limits; the commands it runs stay in the job; `killTree` |
| git | Waits up to 5 s for a foreign lock; detached run checkout at the main line tip; `land`: one commit fast-forwarded or replayed, conflicts take the run's side; `nonLinear`: branches, detached HEAD, merges; a commit of files rebuilt on a moved tip unless they changed; `fileHistory` |
