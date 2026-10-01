---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec/components
    relation: part_of
  - to: Governance/DesignDoc/components/automations
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Orchestrator

Starts and supervises the automation loops per enabled project, in the API's deployable.

- Runs start from trigger entities: schedule, event or on demand
- Loops pause when the feed reaches its limit
- Enabling a project starts the graph build; disabling stops everything
- Reset wipes a project's entities, runs and branches and rebuilds; the harness workspace cannot be reset
- One killable Claude Code process per run, with its own checkout, branch and limits
- Usage shows live; a killed run's writes still pass the guard to the feed
- Concurrency is configurable, bounded by API limits and tuned from measurements
