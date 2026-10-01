---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/backend
    relation: part_of
  - to: Architecture/Component/attention-feed
    relation: bounded_by
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
  - to: Harness/Automation/chat
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

Starts and supervises the automation loops of every enabled project, `apps/backend/src/orchestrator.ts`.

- Ticks every 30 s and on run end or feed change: indexes main lines, queues due scheduled runs while the feed has room, starts queued runs within the limits (2 per project, 8 in total by default)
- Schedules and events come from each workspace's approved trigger entities: `entity_ahead` starts implementation, `implementation_finished` validation
- Enabling a project materializes definitions, indexes it, proposes default triggers and starts the mapping build, one run at a time on `momentum/mapping/<workspace>`
- An artifact change starts summarization directly
