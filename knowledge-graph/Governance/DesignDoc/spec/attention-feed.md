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
artifacts:
  - docs/SPEC.md
---
# Spec: attention feed

- One feed across the enabled projects; items are entities of any type
- The user verifies, approves or sends back; a reaction can be a change request, a split or new entities
- The approved state is the system: nothing changes unattended
- Counters by state: verified, unverified and each sync state
- Ranked by impact on the product, impact on the timeline and how much the work unlocks
- No project priority; the feed size bounds the loops
