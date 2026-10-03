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

- Hooks: PostToolUse reports issues on each write; Stop hands artifacts to summarization (once), sends the run back to fix issues (twice at most), then asks for a commit message
- Run end: one transaction checked for type, path, card limit, references; landed with the run's message; invalid → Harness/Issue, conflicts → Harness/Conflict
- Main line: reindexes changed entities; those over changed artifacts go artifact_ahead unless they changed too
- Index: an unverified card gets its diff against its last verified version in git history
- Metrics: entities per state, run histograms
