---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/mapping
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Mapping plan

- Starts on project enable; no trigger entity
- Runs continue on `momentum/mapping/<workspace>`; one queued only while the feed has room and none is open, writing at most that many entities
- Each run reports progress, covered share (0–1) and completion via `report_mapping`; the next prompt carries it
- The harness summarizes the documents a run listed, minus excluded paths
- Build estimate: time and usage so far ÷ covered share
- State (building, stopped, complete) in harness schema; Stop, Resume; disable stops, enable resumes
- Reset (two taps): kills runs, drops checkouts, `momentum/` branches, `knowledge-graph/` on main and the schema, then re-enables; 409 on the harness
