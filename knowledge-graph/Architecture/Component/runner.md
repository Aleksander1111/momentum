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

Claude Code session per run, in the project dir

- **States**: serial per run; a killed queued run never runs
- **Messages**: in order; queued ones join the prompt
- **Base**: the dir as found, uncommitted work too; the run's is what differs
- **Stop hook**: its changes, build docs summarized; results `implements` target
- **Finish**: never rejects; guard lands; usage, metrics; 3 failed builds halt
- **Restart**: lost runs resume ≤2×; chats, interviews fail, resume on message
- **Activity**: turns of calls, tokens; rated by the [retrieval rater](Architecture/Component/retrieval-rater)
- **Timeline**: end event, state moves
- **Under way**: queued, running; chats to `chats/<id>.jsonl`
