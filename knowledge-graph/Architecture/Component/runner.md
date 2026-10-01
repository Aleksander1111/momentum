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

One Claude Code session per run, own branch and checkout.

- **Start**: worktree off main, guard watching; KB and run MCP, hooks, limits
- **Model**: from settings; implementation's by risk from its plans
- **Stop hook**: changed artifacts and graph build documents to summarization
- **Usage**: each rise of the shared limits split among concurrent runs
- **Finish**: guard transaction, status, metrics; graph build records coverage; validation merges, holds or raises a Harness/Conflict
- **Restart**: a lost run requeues and resumes its session, twice at most, then fails
- **Chat**: resumes its session; transcript to `chats/<id>.jsonl`
- Stops runs per automation or workspace; frees checkouts
