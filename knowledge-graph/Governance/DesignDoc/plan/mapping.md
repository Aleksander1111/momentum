---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
  - to: Harness/Automation/mapping
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Plan: mapping and defaults

- Mapping starts when a project is enabled, on `momentum/mapping/<workspace>`
- Runs are queued only while the feed has room; progress and covered share reported via `report_mapping`
- Full build estimated from time and usage so far over the covered share
- Stop, resume and reset from Settings; reset rebuilds from the top
- Default triggers: exploration and preparation every two hours; nightly validation, consistency check, retention, optimization
- A chat stays open ten minutes after its last answer
