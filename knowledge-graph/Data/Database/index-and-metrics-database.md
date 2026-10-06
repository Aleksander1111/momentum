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

Postgres with pgvector, the queryable side of the knowledge base, migrated on start.

| Schema | Holds |
|---|---|
| harness | project (indexed commit, graph build, logo), setting, credential, session, usage_sample, voice_cursor, run_ref |
| ws_<workspace> | entity (tsvector, 384-dim embedding, card blocks, diff, contradictions), entity_state, entity_artifact, entity_reference, automation, run, run_message, chat, transaction, attention_ranking/metric/pattern, understanding/agent/implementation metrics, usage_share |

- Status columns checked against the contract's enums, replaced each start
- Indexed for metrics, the run queue, chats on an entity
- Pruned: sessions, readings past 35 days
