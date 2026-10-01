---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 4
references:
  - to: Harness/Automation/consistency-check
    relation: served_by
  - to: Harness/Automation/validation
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Consistency grows

First success criterion of the spec: consistency grows across every project the harness touches. The harness earns its place only if it boosts the user's performance instead of costing attention.

- **Served by** the consistency guard, which validates card limits and references of every transaction before the main line, and the consistency check loop, which raises each kind of issue as an entity
- **Tracked** as the understanding metric `consistency`, recorded with every validated transaction so the trend is visible
- **Siblings:** work arrives as one consistent piece; the system stays flexible without constant modification
