---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec/components
    relation: part_of
  - to: Governance/DesignDoc/components/index-and-metrics-database
    relation: depends_on
artifacts: []
---
# Attention feed

One feed across enabled projects for everything needing the user.

- Items are entities of any type; the user approves, sends back, resolves or won't resolve, in any form: change request, split, new entities
- Everything a run writes lands unverified on the main line and shows in the feed; approval is the user's review and, for implementable entities, what starts implementation; removals and definition changes are in effect as they land, triggers wait for approval
- Counters show entities by state: verified, unverified and each sync state
- Ranking: what to do now, from product impact, timeline impact and unlocks
- No project priority; ranking comes from the entities
