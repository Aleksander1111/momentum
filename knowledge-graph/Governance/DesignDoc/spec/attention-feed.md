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
  - docs/diagrams/09-attention-feed.md
---
# Attention feed

One feed across the enabled projects where everything needing the user's attention shows up; nothing changes unattended.

- Items are entities of any type; the user verifies, approves or sends back (change request, split, new entities)
- Approval makes a change part of the system; unapproved work sits outside the project
- Ranking: what to do now for the best product on an optimal path, from impact on the product, impact on the timeline and unlocks; no project priority
- Counters above the cards: entities by state, verified/unverified and each sync state
- Time per item and reactions feed attention metrics; regular patterns become automatic approval or rejection
