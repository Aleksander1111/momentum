---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/validation
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# Runner

One Claude Code session per run, on its own branch and checkout.

- **Start**: worktree off the main line, guard watching; KB and run MCP, hooks, limits
- **Model**: from settings; an implementation's by risk from its plans
- **Stop hook**: hands summarization changed artifacts and graph build documents
- **Usage**: each rise of the shared limits split among concurrent runs, 5-hour and weekly %
- **Finish**: guard transaction, status, metrics
- **Then**: graph build records coverage; validation merges, holds, or raises a Harness/Conflict
- **Chat**: resumes its session; transcript to `chats/<id>.jsonl`
- Stops runs per automation or workspace; fails runs lost at restart; frees checkouts
