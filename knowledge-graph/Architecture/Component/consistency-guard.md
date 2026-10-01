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
    relation: triggers
artifacts:
  - apps/backend/src/guard.ts
  - apps/backend/src/hooks.ts
  - apps/backend/src/metrics.ts
---
# Consistency guard

Validates each run's knowledge-base changes and keeps the index true to the main line.

- In the run: PostToolUse flags issues per write; Stop sends the run back to fix them, twice at most
- Run end: changes against the main line form one transaction (type, path, card limit, references)
- Valid: indexed unverified, enter the feed; invalid: `Harness/Issue/guard-<run>` enters the feed
- Main line: reindexes changed entities; an artifact changed without its entity sets `artifact_ahead` and triggers summarization
- Sync: updating, artifact_ahead, entity_ahead (approved, not implemented), synced
- Records consistency and implementation metrics
