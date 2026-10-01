---
type: Data/Database
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references: []
artifacts:
  - packages/kb/src/db.ts
  - docs/diagrams/11-database.md
---
# Index and metrics database

Postgres with pgvector, database `momentum`: the queryable side of the knowledge base.

| Schema | Holds |
|---|---|
| harness | project, setting, credential, session, usage_sample; run_ref maps runs to workspaces |
| ws_<workspace> | entity (tsvector + embedding), entity_artifact, entity_reference, automation, run (with usage and the model and risk it started on), run_message, chat, transaction, attention_ranking (rank = sum of the three impacts), attention_metric, attention_pattern, understanding_metric, agent_metric, implementation_metric |

Updated by the consistency guard on every validated transaction; the feed order is read from attention_ranking.
