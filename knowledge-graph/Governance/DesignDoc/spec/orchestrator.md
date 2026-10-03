---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
artifacts: []
---
# Spec: orchestrator and runs

Ships in the API back-end; only runs are separate processes.

- Schedules loops of enabled projects from their trigger entities: schedule, event or on demand
- Loops pause when the feed hits its limit
- Each run: one Claude Code process in its own detached checkout of the main line, killable, own limits; usage shown live; what it leaves lands when it ends
- Automation runs go one at a time per project; user-started runs go at once
- A run a restart cuts off resumes its session, twice at most, then fails
- Killed or failed runs' work still reaches the feed
- Enabling a project starts the graph build; reset wipes entities, runs and database, then rebuilds (not the harness workspace)
