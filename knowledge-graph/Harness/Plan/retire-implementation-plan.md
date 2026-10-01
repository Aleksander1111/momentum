---
type: Harness/Plan
origin: requested
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Governance/DesignDoc/plan
    relation: retires
  - to: Governance/DesignDoc/plan/work-packages
    relation: retires
artifacts: []
---
# Retire the implementation plan

The implementation plan is no longer needed (user, from the feed).

- Retires the plan and its work packages entity; approval removes them from main
- Deletes docs/PLAN.md and its pointers in code comments
- Approval removes `retires` targets itself; the retired files stay on the branch, so the guard accepts it
