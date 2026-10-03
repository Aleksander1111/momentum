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

- **Start**: checkout at the tip; guard, KB and run MCP, hooks; one automation run per workspace
- **Model**: from settings, or by risk for an implementation
- **Messages**: in order; to a queued run join its prompt
- **Stop hook**: changed artifacts, graph-build documents to summarization, once per state of those artifacts
- **Finish**: guard lands it; usage split, metrics, coverage
- **Restart**: lost runs resume twice at most
- **Timeline**: queued, started (model, risk), resumed, ended (status, usage, duration, by user); chats, interviews only failed
- **Chat**: transcript `chats/<id>.jsonl`
