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

- Own worktree `C:\Projects\.runs\<workspace>\<run-id>`, branch `momentum/<automation>/<run-id>`; send back and mapping continue a branch
- Agent SDK session: the automation's agent file, summarization and card sub-agents, `momentum-kb` and `momentum-run` MCP, guard hooks, procgov limits
- On end: guard transaction, transcript to `chats/<id>.jsonl`, a passed validation merges; usage in 5-hour and weekly percentage points
- At startup, runs left `running` still pass the guard and are failed as lost at restart
- A project reset kills a workspace's runs and waits for them to finish
