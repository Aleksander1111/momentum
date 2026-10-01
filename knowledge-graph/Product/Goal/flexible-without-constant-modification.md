---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Product/Product/momentum
    relation: goal_of
  - to: Harness/Automation/optimization
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Flexible enough to keep working

Success criterion from the spec: the system is flexible enough that it does not need constant modification to keep working.

- Automations are defined by responsibility alone and configured through entities, not settings
- Optimization proposes skills, sub-agents and definition changes from measured behaviour
- Concurrency and ranking are tuned from measurement rather than fixed upfront
