---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/summarization
    relation: served_by
  - to: Harness/Automation/validation
    relation: served_by
  - to: Harness/Automation/implementation
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Work arrives as one consistent piece

Success criterion from the spec: work reaches the user as one consistent piece, not as fragments to assemble.

- A run's Stop hook hands every artifact it touched to summarization before the run ends, so no work waits unsummarized and every entity has its card before it reaches the feed
- The consistency guard groups related changes into a transaction and checks card limit and references before the main line
- Implementation branches merge once validation passes; failures, conflicts and merge resolutions reach the feed as entities
