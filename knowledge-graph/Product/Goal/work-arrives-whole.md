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
  - to: Harness/Automation/card
    relation: served_by
  - to: Harness/Automation/validation
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Work arrives as one consistent piece

Success criterion from the spec: work reaches the user as one consistent piece, not as fragments the user has to assemble.

- Summarization writes each summary before the user reads the work; every entity has its card before it reaches the feed
- The consistency guard groups related changes into a transaction and validates them together before they land on the main line
- Implementation branches merge automatically once validation passes; failed validations, conflicts and merge resolutions surface as entities in the feed
