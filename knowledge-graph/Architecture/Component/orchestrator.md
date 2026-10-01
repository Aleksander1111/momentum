---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/mapping
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

Starts and supervises the automation loops of every enabled project in the back end.

- **Tick**: indexes main lines; while the feed has room, queues due cron triggers and one mapping run per workspace; starts queued runs within total and per-project limits, one run per branch at a time
- **Events**: entity_ahead → implementation, implementation_finished → validation, artifact_ahead → summarization (no trigger entity)
- **Enable**: materializes definitions, indexes, proposes default triggers, starts the build
- **Disable**: stops a build; **reset**: ends runs, drops run branches, the knowledge graph and the index
