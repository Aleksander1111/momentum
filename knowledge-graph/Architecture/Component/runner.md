---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/interview
    relation: concerns
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

One Claude Code session per run, in a detached checkout of the main line.

- **Start**: checkout at the tip; guard, KB and run MCP, hooks
- **Messages**: in order; to a queued run join its prompt; stopped queued runs never start; bookkeeping turns stay out of chats
- **Stop hook**: artifacts, build documents to summarization once per state
- **Finish**: guard lands it; usage, metrics, coverage; failed summarization: targets artifact_ahead; a build run without report fails; 3 in a row stop the build
- **Restart**: lost runs resume twice at most
- **Timeline**: one event per run; chats, interviews only when failed
- **Chat**: transcript `chats/<id>.jsonl`
