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

- Runs as a background loop and on demand
- Reads the knowledge graph alone, never the artifacts behind summaries
- Files every finding as its own Harness/Issue under twelve categories: rule categories (reference, card-limit, type-path) by queries; content categories by reading, with a severity: high (contradiction, logical, ambiguity), medium (design-gap, naming, repetition), low (verbose, struct, split)
- An issue references the entities concerned, the one at fault first, and offers 2-4 options (label, change), one recommended only when obviously best, for the user to pick in the feed
- Fixes nothing itself
