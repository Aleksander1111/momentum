---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/summarization
    relation: provides
  - to: Harness/Automation/card
    relation: provides
artifacts:
  - apps/backend/src/runner.ts
  - apps/backend/src/events.ts
---
# Runner

One Claude Code process per run, `apps/backend/src/runner.ts`.

- Own worktree `C:\Projects\.runs\<workspace>\<run-id>`, branch `momentum/<automation>/<run-id>`; send back and chat messages continue a branch
- Agent SDK session: automation's agent file, summarization and card sub-agents, `momentum-kb` and `momentum-run` MCP, guard hooks, procgov limits
- Usage in 5-hour and weekly percentage points, live while it runs
- On end: guard transaction, chat transcript to `chats/<id>.jsonl`; mapping records coverage for the full-build estimate; a passed validation merges
- Runs left `running` at restart pass the guard and fail as lost
- A project reset kills a workspace's runs, waiting for them
