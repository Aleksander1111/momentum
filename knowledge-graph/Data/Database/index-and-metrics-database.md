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
  - apps/backend/src/timeline.ts
  - apps/backend/src/harness.ts
---
# Index and metrics database

Postgres with pgvector, the queryable side of the knowledge base, migrated on start.

| Schema | Holds |
|---|---|
| harness | project (indexed commit, graph build, logo), setting, credential, session, usage_sample, voice_cursor, run_ref, timeline_event |
| ws_<workspace> | entity (tsvector, 384-dim embedding, card blocks, diff), entity_state/artifact/reference, automation, run, run_message, run_turn, run_step, chat, transaction, attention ranking/metric/pattern, understanding/agent/implementation/rag/retrieval metrics, usage_share |

- Status columns checked against the contract's enums
- Indexed for metrics, the run queue, chats
- Pruned: sessions, readings past 35 days
