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
  - apps/backend/src/serial.ts
  - apps/backend/src/usage.ts
  - apps/backend/src/models.ts
  - apps/backend/src/protocol.ts
  - apps/backend/src/hooks.ts
---
# Runner

One Claude Code session a run, in a detached main-line checkout.

- **States**: start, message, kill serial per run, guarded; a killed queued run never starts; open runs by automation or target
- **Messages**: in order; a queued run's join its prompt
- **Stop hook**: artifacts, build documents summarized once a state; results `implements` the target
- **Finish**: never rejects; guard lands it; usage, metrics; failed summarization: targets artifact_ahead; 3 failed builds in a row stop it
- **Restart**: lost runs resume ≤2×; chats and interviews fail at once, resume on the next message; entities no open run holds leave updating
- **Timeline**: event a run
- **Chat**: `chats/<id>.jsonl`
