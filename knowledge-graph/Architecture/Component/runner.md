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

One Claude Code session a run, in a detached main-line checkout.

- **States**: start, message, kill serial per run, guarded; a killed queued run never starts; open runs by automation or target
- **Messages**: in order; a queued run's join its prompt; bookkeeping kept out of chats
- **Stop hook**: artifacts, build documents summarized once a state; results `implements` the target
- **Finish**: never rejects; guard lands it; usage, metrics; failed summarization: targets artifact_ahead; 3 failed builds in a row stop it
- **Restart**: lost runs resume ≤2×; entities no open run holds leave updating
- **Timeline**: event a run; chats, interviews if failed
- **Chat**: `chats/<id>.jsonl` transcript
