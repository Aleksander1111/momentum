---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/consistency-check
    relation: served_by
artifacts:
  - docs/SPEC.md
  - apps/backend/src/guard.ts
---
# Consistency grows across every project

First success criterion of the spec: the harness earns its place only if consistency grows across every project it touches, boosting the user instead of costing attention.

- **Measured** as the understanding metric: the share of entities whose card is within the character limit and whose references all resolve
- **Recorded** by the consistency guard with every validated transaction, tracked over time on the metrics screen
- **Open issues** (Harness/Issue, Harness/Conflict) are recorded alongside it, not subtracted from it
- **Served** by the guard on every change and by the consistency check loop
