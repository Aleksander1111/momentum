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

Claude Code session per run, detached checkout

- **States**: serial per run; a killed queued run never runs
- **Messages**: in order; queued ones join the prompt
- **Stop hook**: artifacts, build docs summarized, no chats; results `implements` target
- **Finish**: never rejects; guard lands; usage, metrics; 3 failed builds halt
- **Restart**: lost runs resume ≤2×; chats, interviews fail, resume on message
- **Activity**: a session is a turn of calls, tokens; if it retrieved, rated at run end by the [retrieval rater](Architecture/Component/retrieval-rater); prompts: tools in parallel
- **Timeline**: an end event with state moves
- **Under way**: queued, running; chats to `chats/<id>.jsonl`
