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
  - to: Harness/Automation/summarization
    relation: served_by
  - to: Harness/Automation/validation
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Work arrives as one consistent piece

Success criterion from the spec: work reaches the user as one consistent piece, not as fragments the user has to assemble.

- Summaries and cards are written before the user reads the work
- A transaction groups the related changes of one run and is validated together
- Implementation branches are validated and merged automatically; only issues and conflicts ask for attention
