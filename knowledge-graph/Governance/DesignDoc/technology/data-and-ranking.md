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
  - docs/PLAN.md
---
# Data, retrieval and ranking

- **Database:** Postgres 18 + pgvector (Docker), database `momentum`, schema `ws_<workspace>`, postgres.js; tables of SPEC plus `transaction` and `run_message`
- **Graph RAG:** `ts_rank` + pgvector cosine (bge-small, in-process) + recursive CTE over `entity_reference`
- **Ranking:** product_impact + timeline_impact + unlocks (0–5, author-set), generated on index update; earliest wins ties; tuning open
- **Cross-project feed:** `UNION ALL` of enabled schemas; counters by verification and sync state
- **Harness settings:** schema `harness` (projects, build state, feed, lifetimes, cards, unsummarized paths, concurrency, models, sessions, run workspaces, usage); enabling makes no commits
