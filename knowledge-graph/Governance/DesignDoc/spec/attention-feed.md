---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - docs/SPEC.md
---
# Spec: attention feed

One feed where everything needing the user's attention shows up; items are entities of any type.

- Verify, approve or send back; a reaction can be a change request, a split or new entities
- Nothing changes unattended: the approved state is the system
- Counters above the cards: entities of the enabled projects by verification and sync state
- One feed across projects; it follows the enabled set
- Ranking asks what to do now for the best product and an optimal journey: impact on product, impact on timeline, unlocks
- Features, optimizations, refactorings and explorations compete on one scale
- No project priority
