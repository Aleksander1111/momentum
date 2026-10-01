---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/validation
    relation: concerns
  - to: Harness/Automation/mapping
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# Runner

Backend component that runs each automation as one Claude Code session on its own branch and checkout.

- **Queue → start**: worktree off the main line, guard watches it, KB and run-report MCP tools attached
- **Model**: set once at first start — one for all, per automation, or for an implementation by risk estimated from its plans
- **Finish**: guard transaction, status, usage in percent, agent metrics
- **After**: mapping records coverage; passed validation merges, failed holds; merge conflict raises a Harness/Conflict
- **Chat**: resumes its session; transcript saved to `chats/`
- Recovers runs lost at restart; removes finished checkouts
