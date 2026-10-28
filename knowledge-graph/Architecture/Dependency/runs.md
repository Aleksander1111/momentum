---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 3
references:
  - to: Code/Repository/momentum
    relation: part_of
  - to: Architecture/Dependency/contract
    relation: depends_on
artifacts:
  - packages/runs/package.json
  - packages/runs/src/index.ts
  - packages/runs/src/session.ts
  - packages/runs/src/process.ts
  - packages/runs/src/git.ts
kind: internal library
---
# runs

`@momentum/runs`: how the backend runs runs.

| Module | Provides |
|---|---|
| session | `startSession`: one resumable Claude Code process a run, told its prompt; a message sent while it runs waits for its next turn; one dead before its session starts is restarted; 5h/weekly usage %; tool calls, results, tokens; `ask`: one tool-less turn |
| process | `spawnLimited`: procgov CPU/memory limits; env without `DATABASE_URL`, `PG*`, `MOMENTUM_*` (`MOMENTUM_RUN_DATABASE_URL` as `DATABASE_URL`); `killTree` |
| git | 5 s lock wait; changes read as stored (`autocrlf=input`); `land`: the run's changes only, one commit on main; reactions merged in; `nonLinear` (branches, worktrees, merges); `restorePath`; `fileHistory`; `lastCommitMessage` |
