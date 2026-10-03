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
---
# Index and metrics database

Postgres with pgvector, the queryable side of the knowledge base, migrated idempotently on start.

| Schema | Holds |
|---|---|
| harness | project, setting, credential, session, usage_sample, voice_cursor (last voice item per session) |
| ws_<workspace> | entity (tsvector, 384-dim embedding, card diff while unverified), entity_state, entity_artifact, entity_reference, automation, run (usage, model, risk, restarts, interview), run_message (context), chat, transaction, attention_ranking (sum of impacts), attention_metric, attention_pattern, understanding_metric, agent_metric, usage_share, implementation_metric |

The migration renames mapping to graph-build and seeds entity_state.
