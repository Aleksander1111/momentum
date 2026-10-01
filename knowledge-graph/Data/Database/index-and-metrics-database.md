---
type: Data/Database
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - packages/kb/src/db.ts
  - docs/diagrams/11-database.md
---
# Index and metrics database

Postgres with pgvector: the queryable side of the knowledge base, migrated idempotently on start.

| Schema | Holds |
|---|---|
| harness | project (path, enabled), setting, credential, session, usage_sample |
| ws_<workspace> | entity (tsvector + 384-dim embedding), entity_artifact, entity_reference, automation, run (usage, model, risk), run_message, chat, transaction, attention_ranking (rank = sum of the three impacts), attention_metric, attention_pattern, understanding_metric, agent_metric, implementation_metric |

The migration renames the old mapping automation to graph-build in runs, branches and metrics.
