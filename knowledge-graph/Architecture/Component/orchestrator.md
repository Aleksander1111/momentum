---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/validation
    relation: concerns
artifacts:
  - apps/backend/src/orchestrator.ts
---
# Orchestrator

Starts and supervises the automation loops of each enabled project.

- **Tick**: indexes main lines; while the feed has room, queues due cron triggers and a graph build run; starts queued runs within the total, one automation run per project at a time, user runs at once
- **Events**: entity_ahead → implementation, implementation_finished → validation, artifact_ahead → one summarization run over the touched entities, set updating
- **Enable**: materializes, indexes, commits "Add the default triggers", builds unless complete
- **Disable**: stops a build; **reset** (not the harness): ends runs, removes checkouts and old branches, commits "Reset the knowledge graph", drops the index
