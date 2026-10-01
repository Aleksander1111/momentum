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
- Runs continue on `momentum/mapping/<workspace>`; one is queued only while the feed has room and none is open, writing at most that many entities
- Runs report progress, covered share (0–1) and completion via `report_mapping`; the next prompt gets it
- Time spent = sum of run durations; full build ≈ time and usage so far ÷ covered share
- State (building, stopped, complete) in harness schema; Stop, Resume; disable stops, enable resumes
- Reset (two taps): stops runs, removes checkouts, `momentum/` branches, deletes `knowledge-graph/` from main in one commit, drops the workspace schema, re-enables from the top; 409 for the harness workspace
