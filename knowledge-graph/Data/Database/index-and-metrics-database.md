---
type: Data/Database
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Infrastructure/Environment/dedicated-machine
    relation: hosted_on
artifacts:
  - packages/kb/src/db.ts
  - docs/diagrams/11-database.md
---
# Index and metrics database

Postgres 18 with pgvector in Docker on the dedicated machine, database `momentum`: the queryable side of the knowledge base.

| Schema | Holds |
|---|---|
| harness | project (path, enabled), setting, credential, session, usage_sample; run_ref maps run ids to workspaces |
| ws_<workspace> | entity (tsvector + 384-dim embedding), entity_artifact, entity_reference, automation, run, run_message, chat, transaction, attention_ranking (rank stored as the sum of the three impacts), attention_metric, attention_pattern, understanding_metric, agent_metric, implementation_metric |

Updated by the consistency guard on every validated transaction; the API reads the feed order from attention_ranking.
