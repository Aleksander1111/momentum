---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 2
unlocks: 4
references:
  - to: Harness/Automation/consistency-check
    relation: served_by
artifacts:
  - apps/backend/src/guard.ts
  - docs/SPEC.md
---
# Consistency grows across every project

First success criterion of the spec: the harness earns its place only if consistency grows in every project it touches, boosting the user instead of costing attention.

- **Measured** as 1 − inconsistent/total entities; inconsistent = card over the character limit or a reference that does not resolve (empty base = 1)
- **Recorded** in understanding_metric by the consistency guard after every validated transaction and main-line reindex, tracked over time
- **Open issues** (Harness/Issue, Harness/Conflict) stored beside it, not subtracted; with bugs and validation defects they also feed the implementation metric
- **Served** by the guard on every change and by the consistency check loop
