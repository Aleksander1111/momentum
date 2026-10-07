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

A Claude Code session per run, in a detached checkout

- **States**: start, message, kill serial per run; killed queued runs never run; open runs by automation, target
- **Messages**: in order; queued, they join the prompt
- **Stop hook**: artifacts, build documents summarized; results `implements` target
- **Finish**: never rejects; guard lands it; usage, metrics; failed summary: targets artifact_ahead; 3 failed builds halt
- **Restart**: lost runs resume ≤2×; chats, interviews fail, resume on message; unheld entities leave updating
- **Timeline**: an event once it lands or ends, with state moves of a kill or what's left behind
- **Under way**: queued, running; chats in `chats/<id>.jsonl`
