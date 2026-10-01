---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/backend
    relation: part_of
  - to: Architecture/Dependency/runs
    relation: depends_on
  - to: Architecture/Component/consistency-guard
    relation: depends_on
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

- Each run gets a git worktree under `C:\Projects\.runs\<workspace>\<run-id>` on branch `momentum/<automation>/<run-id>`; send back and mapping continue an existing branch
- A Claude Agent SDK session: the automation's agent file as instructions, summarization and card as sub-agents
- Gets the `momentum-kb` and `momentum-run` MCP servers in-process, plus the guard's hooks
- procgov job object (4 GB, 4 cores by default); killed with its process tree
- On end: guard transaction, chat transcript to `chats/<id>.jsonl`, a passed validation merges its branch; usage recorded as percentage points of the 5-hour and weekly limits
