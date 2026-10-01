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
artifacts:
  - docs/SPEC.md
---
# Consistency grows

The first success criterion in the spec: consistency grows across every project the harness touches. The harness earns its place only if it boosts the user's performance instead of costing attention.

- **Served by** the consistency check loop, which raises issues, and the consistency guard, which validates every transaction's card limits and references before it lands on the main line
- **Tracked** as the understanding metric `consistency`, which the guard records with every validated transaction so the trend is visible
- **Sibling criteria:** work arrives as one consistent piece, and the system stays flexible without constant modification
