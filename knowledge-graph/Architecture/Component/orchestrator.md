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

Starts and supervises the automation loops of enabled projects.

- **Tick** on a timer, run end, feed change: indexes main lines, queues due scheduled runs while the feed has room, starts queued runs within total and per-project limits, one run per branch
- **Events**: via triggers, `entity_ahead` → implementation, `implementation_finished` → validation; `artifact_ahead` starts summarization directly, with no trigger
- **Graph build**: one mapping run at a time on one branch, capped by feed room
- **Enable** materializes definitions, indexes, proposes default triggers, starts the build; **disable** stops it
- **Reset** (not the harness) wipes runs, branches, graph, database; re-enables
