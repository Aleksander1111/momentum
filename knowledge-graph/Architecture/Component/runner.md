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
  - to: Harness/Automation/mapping
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# Runner

Runs each automation as one Claude Code session on its own branch and checkout.

- **Start**: worktree off the main line, guard watching; `momentum-kb` and `momentum-run` MCP, guard hooks, procgov limits
- **Model**: chosen once, per settings or, for an implementation, by risk estimated from its plans
- **Finish**: guard transaction, status, usage in 5-hour and weekly percent, agent metrics
- **Then**: queues summarization of changed artifacts and mapped documents; mapping records coverage; passed validation merges, failed holds, a conflict raises a Harness/Conflict
- **Chat**: resumes its session; transcript to `chats/<id>.jsonl`
- Fails runs lost at restart; removes finished checkouts
