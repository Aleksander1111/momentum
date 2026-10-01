---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Code/Repository/momentum
    relation: part_of
  - to: Architecture/Dependency/contract
    relation: depends_on
artifacts:
  - packages/runs/src/git.ts
  - packages/runs/src/process.ts
  - packages/runs/src/session.ts
kind: internal library
---
# runs package

`@momentum/runs`, internal library: the machinery under a run.

- git: worktrees, branches, commits, diffs, commits onto a branch without touching its working tree, and a merge that keeps `knowledge-graph/` as it is on the main line
- process: the run's subprocess in a Windows job object with CPU and memory limits (procgov), killed with its process tree
- session: a Claude Agent SDK session per run, steerable by messages while it runs, with usage captured as a share of the rolling 5-hour and weekly limits
