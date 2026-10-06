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

One Claude Code session per run, in a detached main-line checkout.

- **States**: start, message, kill go one at a time per run, each one guarded step; a run killed queued never starts
- **Messages**: in order; a queued run's join its prompt; bookkeeping stays out of chats
- **Stop hook**: artifacts, build documents to summarization once per state; results `implements` target
- **Finish**: never rejects; guard lands it; usage, metrics; failed summarization: targets artifact_ahead; a build run without report fails, 3 in a row stop the build
- **Restart**: lost runs resume at most twice
- **Timeline**: an event per run; chats, interviews when failed
- **Chat**: transcript `chats/<id>.jsonl`
