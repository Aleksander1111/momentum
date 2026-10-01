---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/backend
    relation: part_of
  - to: Architecture/Component/knowledge-base
    relation: validates
  - to: Data/Database/index-and-metrics-database
    relation: updates
artifacts:
  - apps/backend/src/guard.ts
  - apps/backend/src/hooks.ts
  - apps/backend/src/metrics.ts
---
# Consistency guard

Validates every knowledge-base change of a run and keeps the index true to the main line, `apps/backend/src/guard.ts`.

- Claude Code hooks in every run: PostToolUse reports issues on each write, Stop sends the run back to fix them (twice at most)
- chokidar watches `knowledge-graph/` of every run checkout; issues so far are readable live
- When a run ends, its changes against the main line form one transaction, checked for type, path, card limit and references
- Valid: indexed as unverified, enters the feed, metrics recorded; invalid: a Harness/Issue on the run's branch enters the feed instead
- Maintains sync: updating, artifact_ahead (artifact changed on main), entity_ahead, synced
