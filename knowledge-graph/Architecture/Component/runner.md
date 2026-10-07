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

One Claude Code session a run, in a detached checkout.

- **States**: start, message, kill serial per run; a killed queued run never starts; open runs by automation, target
- **Messages**: in order; a queued run's join its prompt
- **Stop hook**: artifacts, build documents summarized; results `implements` the target
- **Finish**: never rejects; guard lands it; usage, metrics; failed summarization: targets artifact_ahead; 3 failed builds stop it
- **Restart**: lost runs resume ≤2×; chats, interviews fail, resume on a message; entities no open run holds leave updating
- **Timeline**: event a run once it lands or ends
- **Under way**: queued, running automations
- **Chat**: `chats/<id>.jsonl`
