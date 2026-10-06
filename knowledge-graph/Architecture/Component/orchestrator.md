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

- **Tick**: rediscovers repos; disables a project no longer one line, skips what git can't read; hourly prune; indexes; with feed room queues due triggers, a build; starts queued runs: one automation per project, user runs at once, `concurrentTotal` in all
- **Events**: entity_ahead → implementation unless one is open on the same planned work; implementation_finished → validation; artifact_ahead → one summarization run
- **Enable**: only if one line; materializes, indexes, commits default triggers, builds unless complete or stopped
- **Disable**: stops a build; **reset** (not the harness): ends runs, deletes the graph, drops the index
