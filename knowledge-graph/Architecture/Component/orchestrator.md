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

- **Tick**: indexes main lines; while the feed has room, queues due cron triggers and one graph build run per workspace; starts queued runs within total and per-project limits
- **Events**: entity_ahead → implementation, implementation_finished → validation; artifact_ahead → one summarization run over every entity and its changed artifacts, each set updating; approved definitions rematerialized
- **Enable**: materializes definitions, indexes, proposes default triggers, starts the build unless complete
- **Disable**: stops a build; **reset** (not the harness): ends runs, drops run branches, knowledge graph and index
