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

Ships in the API back-end; runs, search answers and risk estimates are the only separate processes.

- Schedules loops of enabled projects from their trigger entities: schedule, event or on demand
- Loops pause when the feed hits its limit
- Each run: one killable Claude Code process in the project folder, on main; what it leaves lands when it ends
- A project's runs go one at a time; user-started runs first
- A run a restart cuts off resumes, twice at most, then fails; a chat or interview fails at once and resumes on the next message
- Killed runs' work still reaches the feed
- Enabling a project starts the graph build; reset wipes and rebuilds (not the harness)
