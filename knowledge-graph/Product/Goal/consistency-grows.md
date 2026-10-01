---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Product/Product/momentum
    relation: goal_of
  - to: Harness/Automation/consistency-check
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Consistency grows across every project

Success criterion from the spec: the harness earns its place only if consistency grows across every project it touches, instead of costing attention.

- Measured as the understanding metric: the share of entities with no card over the limit and no unresolved reference, tracked over time
- Served by the consistency guard on every change and by the consistency check loop
- Open issues (Harness/Issue, Harness/Conflict) count against it
