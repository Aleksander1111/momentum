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
  - apps/backend/src/graph-build.ts
  - apps/backend/src/completeness.ts
  - apps/backend/src/automations.ts
---
# Orchestrator

Runs enabled projects' loops; the CLI's never ticks.

- **Tick**: disables a project no longer one line; prunes; indexes; with feed room queues due triggers; a build by mode: paced, only with room, at most that many entities; full, whatever the feed holds, no limit; starts queued runs: one per project, user's first, `concurrentTotal` in all
- **Events**: entity_ahead → implementation unless one is open on that work; implementation_finished → validation; artifact_ahead → summarization; override_changed → redefines
- **Enable**: if one line; materializes, indexes, default triggers, builds
- **Disable** stops a build; **reset** ends runs, deletes graph, index, attachments; mode outlives both
