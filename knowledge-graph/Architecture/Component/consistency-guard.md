---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
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

- In the run: PostToolUse flags issues per write; Stop first hands the run's artifacts to summarization, then sends it back to fix issues, twice at most
- Run end: changes against the main line form one transaction (type, path, card limit, references)
- Valid: indexed unverified, enter the feed; invalid: `Harness/Issue/guard-<run>`
- Main line: reindexes changed entities; an artifact changed alone sets `artifact_ahead`
- Metrics: consistency and implementation; 30-day series, per-automation runs, failures, usage
