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

- **States**: start, message, kill one at a time per run, each guarded; one killed queued never starts
- **Messages**: in order; a queued run's join its prompt; bookkeeping stays out of chats
- **Stop hook**: artifacts, build documents summarized once per state; results `implements` target
- **Finish**: never rejects; guard lands it; usage, metrics; failed summarization: targets artifact_ahead; 3 failed build runs in a row stop the build
- **Restart**: lost runs resume ≤2 times; entities no open run holds leave updating
- **Timeline**: an event per run; chats, interviews when failed
- **Chat**: transcript `chats/<id>.jsonl`
