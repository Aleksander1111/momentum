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
  - automations/consistency-check/trigger.md
---
# Consistency check

Checks consistency across all entities in the knowledge base.

- Reads the knowledge graph alone, never the artifacts behind summaries
- Files each finding as its own Harness/Issue in one of eleven categories: rule (reference, incl. card links not referenced; type-path) by queries; content by reading, with a severity: high (contradiction, logical, ambiguity), medium (design-gap, naming, repetition), low (verbose, struct, split)
- Naming: unintroduced names, one concept with two names, or the reverse
- Skips what an existing issue covers; an issue links what it names, concerns the entity at fault first, offers 2-4 options, one recommended if obviously best
- Fixes nothing itself
