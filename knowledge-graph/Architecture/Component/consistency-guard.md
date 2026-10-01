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
- Run end: changes against main form one transaction, checked for type, path, card limit and references
- Valid: indexed unverified, into the feed; invalid: a Harness/Issue instead
- Main line: reindexes changed entities, sets artifact_ahead unless the entity changed too, records metrics (charted over 24h, 7d, 30d)
- Sync: updating, artifact_ahead, entity_ahead, synced
