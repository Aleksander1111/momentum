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
| session | `startSession`: one Claude Code process per run via the Agent SDK, steerable by chat, resumable, reports 5-hour/weekly usage %; `ask`: one tool-less turn on a chosen model (e.g. Haiku risk estimate before an implementation) |
| process | `spawnLimited`: run process in a Windows job object with CPU/memory limits (procgov); `killTree` |
| git | Worktree per run on its own branch, commits, and merges into the main line that keep `knowledge-graph/` as is |
