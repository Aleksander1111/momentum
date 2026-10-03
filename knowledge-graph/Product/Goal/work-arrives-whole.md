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
artifacts: []
---
# Work arrives as one consistent piece

Success criterion: work reaches the user whole, not as fragments to assemble.

- A run's Stop hook hands every artifact it touched to summarization before it ends, so no work waits unsummarized
- A main-line change, such as the user's own commit, is summarized in one run listing every entity over it
- The consistency guard groups a run's changes into one transaction, checks card limit and references, and keeps each entity's sync state
- A run a restart cuts off resumes its session rather than leaving work half done
- Implementation lands on the main line when the run ends and validation runs over it; failures, conflicts and resolutions reach the feed as entities
