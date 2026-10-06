---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts: []
---
# Data, retrieval and ranking

- **Database:** Postgres + pgvector (Docker), schemas `ws_<workspace>` and `harness`, postgres.js
- **Graph RAG:** `ts_rank` + pgvector cosine (bge-small) + recursive CTE over references
- **Ranking:** product_impact + timeline_impact + unlocks (0–5, author-set), generated on index update; earliest wins ties
- **Cross-project feed:** `UNION ALL` of enabled schemas; counters by state
- **Metrics:** consistency = share of entities whose references resolve; open issues = unverified Issue, Conflict; bugs = Product/Bug not verified and synced; defects = unverified validation issues
- **Harness settings:** schema `harness`; enabling commits only the default triggers, once
