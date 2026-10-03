---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/plan/implementation-decisions
    relation: part_of
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts: []
---
# Graph build plan

- Starts when a project is enabled; no trigger entity
- Runs land on the main line in turn; one is queued only while the feed has room and no build run is open, writing at most that many entities
- Each run reports progress, covered share (0–1) and completion via `report_graph_build`; the next prompt carries the progress
- Estimate: time and usage so far ÷ covered share
- State (building, stopped, complete) in `harness`; Stop kills the open run, Resume requeues; disable stops, enable resumes
- Reset (two taps): ends runs, drops checkouts, deletes `knowledge-graph/` from the main line in one commit, drops the schema and build state, then enables afresh; 409 on the harness workspace
