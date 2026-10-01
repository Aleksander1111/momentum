---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - docs/SPEC.md
  - docs/diagrams/11-database.md
---
# Database

Tables of the index and metrics database: one store per workspace, updated by the consistency guard on every validated transaction.

- **Index**: `entity` (path, type, title, card, origin, verification, sync), `entity_artifact` (a row makes it a summary), `entity_reference` (`implements` drives sync), `chat`, `automation`, `run` (branch, checkout, target, usage)
- **Feed**: `attention_ranking`, rank read with no work per poll
- **Metrics**: `attention_metric`, `attention_pattern`, `understanding_metric`, `agent_metric`, `usage_share` (each limit rise split among concurrent runs), `implementation_metric`

The diagram still lacks `usage_share` and `run.usage`.
