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
artifacts:
  - docs/SPEC.md
---
# Attention feed

One feed across enabled projects for everything needing the user.

- Items are entities of any type; the user verifies, approves or sends back, in any form: change request, split, new entities
- Nothing changes unattended; approval is what makes a change part of the system, and anything unapproved sits outside the project
- Counters show entities by state: verified, unverified and each sync state
- Ranking: what to do now so the product ends up best and the journey optimal, from product impact, timeline impact and unlocks
- No project priority; ranking comes from the entities
