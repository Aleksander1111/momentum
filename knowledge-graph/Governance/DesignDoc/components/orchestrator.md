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
- Reset wipes a project's entities, runs and database and rebuilds; not the harness workspace
- One killable Claude Code process per run, in its own detached checkout of the main line, with its own limits; what it leaves lands when it ends
- A run cut off by a restart resumes, twice at most
- Automation runs go one at a time per project; user runs go at once
- Usage shows live; a killed run's writes still reach the feed
