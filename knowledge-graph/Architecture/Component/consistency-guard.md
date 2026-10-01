---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/summarization
    relation: hands_off_to
  - to: Harness/Automation/consistency-check
    relation: complements
artifacts:
  - apps/backend/src/guard.ts
  - apps/backend/src/hooks.ts
  - apps/backend/src/metrics.ts
---
# Consistency guard

Validates each run's knowledge-base changes; keeps the index true to the main line.

- Hooks in every run: PostToolUse reports issues on each write; Stop first hands the run's artifacts to summarization (once), then sends the run back to fix issues (twice at most)
- chokidar watches `knowledge-graph/` of each run checkout
- Run end: changes against main form one transaction, checked for type, path, card limit and references; valid → indexed unverified into the feed, invalid → a Harness/Issue
- Main line: reindexes changed entities; those over changed artifacts go artifact_ahead in one event unless they changed too
- Metrics: entities per state, run histograms; unmeasured counts are no data
