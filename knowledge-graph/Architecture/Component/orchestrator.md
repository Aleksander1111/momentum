---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/exploration
    relation: starts
  - to: Harness/Automation/preparation
    relation: starts
  - to: Harness/Automation/consistency-check
    relation: starts
  - to: Harness/Automation/retention
    relation: starts
  - to: Harness/Automation/implementation
    relation: starts
  - to: Harness/Automation/validation
    relation: starts
  - to: Harness/Automation/optimization
    relation: starts
  - to: Harness/Automation/summarization
    relation: starts
  - to: Harness/Automation/mapping
    relation: starts
artifacts:
  - apps/backend/src/orchestrator.ts
  - apps/backend/src/mapping.ts
  - apps/backend/src/automations.ts
  - docs/diagrams/05-orchestrator.md
---
# Orchestrator

Starts and supervises the automation loops of every enabled project.

- **Tick** every 30 s and on run end or feed change: indexes main lines, queues due scheduled runs while the feed has room, starts queued runs within 2 per project, 8 in total
- **Events** from approved triggers: `entity_ahead` starts implementation, `implementation_finished` validation; `artifact_ahead` starts summarization directly
- **Enable**: materializes definitions, indexes, proposes default triggers, builds the knowledge graph one mapping run at a time
- **Reset**: ends every run, deletes run branches, the knowledge graph and the database, then enables it afresh; never the harness
