---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
artifacts: []
---
# Spec: attention feed

One feed across enabled projects where everything needing the user shows up; items are entities of any type.

- The user verifies, approves or sends back; a reaction can be a change request, a split or new entities
- The approved state is the system: nothing unapproved counts
- Counters above the cards show entities by state: verification and sync
- Ranked by impact on the product, impact on the timeline and how much the work unlocks, so features, optimizations and refactorings compete on one scale
- No project priority: rank comes from the entities
