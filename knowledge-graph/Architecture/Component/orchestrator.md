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

Runs the loops of enabled projects.

- **Tick**: rediscovers repositories; switches off a project no longer one line; indexes main lines; with feed room, queues due triggers and a build run; starts queued runs: one automation run per project, user runs at once
- **Events**: entity_ahead → implementation, implementation_finished → validation, artifact_ahead → one summarization run, with new uncovered files once the graph is complete
- **Enable**: refused unless one line; materializes, indexes, commits default triggers, builds
- **Disable**: stops a build; **reset** (not the harness): ends runs, removes checkouts, deletes the graph in one commit, drops the index
