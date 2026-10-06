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

- The user approves (verifies), sends back, resolves or won't resolve; a reaction can be a change request, a split or new entities
- Everything a run writes lands on the main line unverified and waits in the feed; approval is the user's review and, for implementable entities, what starts implementation; only triggers wait for it to take effect
- Counters above the cards show entities by state: verification and sync
- Ranked by impact on the product and the timeline and by what the work unlocks
- No project priority: rank comes from the entities
