---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/consistency-check/agents/momentum-consistency-check.md
---
# Consistency check

Checks consistency across all entities in the knowledge base and raises each finding as its own Harness/Issue.

- Rule categories first, by queries: reference, card-limit, type-path, stale-summary, drift
- Content categories next, by reading: contradiction, repetition, ambiguity, design-gap, logical, naming, struct, verbose, split
- Each issue has exactly one category and concerns the entity at fault first, then the ones it clashes with
- Card: the problem in one sentence and 2-4 options to resolve it
- Skips findings an existing issue covers; fixes nothing itself
