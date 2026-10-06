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
artifacts: []
---
# Orchestrator

Runs the automation loops per enabled project, in the API's process.

- Runs start from trigger entities: schedule, event or on demand
- Loops pause when the feed reaches its limit
- Enabling a project starts the graph build; disabling stops the build, running runs finish, queued ones wait
- Reset wipes a project and rebuilds; not the harness
- One killable Claude Code process per run, in its own checkout of the main line; what it leaves lands when it ends
- A run cut off by a restart resumes, twice at most; a chat or interview fails at once and resumes on the next message
- Automation runs go one at a time per project; user runs at once
- A killed run's writes reach the feed
