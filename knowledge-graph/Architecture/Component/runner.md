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
  - to: Architecture/Component/retrieval-rater
    relation: uses
artifacts:
  - apps/backend/src/runner.ts
  - apps/backend/src/serial.ts
  - apps/backend/src/usage.ts
  - apps/backend/src/models.ts
  - apps/backend/src/protocol.ts
  - apps/backend/src/hooks.ts
---
# Runner

A Claude Code session per run, detached checkout

- **States**: serial per run; killed queued runs never run
- **Messages**: in order; queued, they join the prompt
- **Stop hook**: artifacts, build documents summarized, not chats; results `implements` target
- **Finish**: never rejects; guard lands it; usage, metrics; 3 failed builds halt
- **Restart**: lost runs resume ≤2×; chats, interviews fail, resume on message
- **Activity**: each session a turn of tool calls and tokens; a chat's rated by the [retrieval rater](Architecture/Component/retrieval-rater)
- **Timeline**: an event when it ends, with state moves
- **Under way**: queued, running; chats in `chats/<id>.jsonl` for the optimization
