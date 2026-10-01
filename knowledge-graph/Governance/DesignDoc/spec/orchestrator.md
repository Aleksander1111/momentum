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
artifacts:
  - docs/SPEC.md
---
# Spec: orchestrator and runs

Ships in the API back-end; only runs are separate processes.

- Schedules loops of enabled projects from their trigger entities: schedule, event or on demand
- Loops pause when the feed hits its limit
- Each run: one Claude Code process, own checkout and branch, killable, own limits; usage shown live
- Killed runs' work still passes the guard to the feed
- Enabling a project starts the graph build; reset wipes entities, branches and DB, then rebuilds (not the harness workspace)
- Concurrency tuned from measured behaviour, bounded by API limits
- Front-end polls the API; no push channel
