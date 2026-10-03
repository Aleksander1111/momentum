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

Checks consistency across all entities in the knowledge base.

- Reads the knowledge graph alone, never the artifacts behind summaries
- Files each finding as its own Harness/Issue in one of twelve categories: rule (reference, card-limit, type-path) by queries; content by reading, with a severity: high (contradiction, logical, ambiguity), medium (design-gap, naming, repetition), low (verbose, struct, split)
- Naming covers unintroduced names, one concept under different names and one name for different concepts
- Skips findings an existing issue covers; an issue concerns the entity at fault first and offers 2-4 options, one recommended only when obviously best
- Fixes nothing itself
