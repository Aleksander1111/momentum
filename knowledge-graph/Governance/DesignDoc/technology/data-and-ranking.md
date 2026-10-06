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

- **Database:** Postgres 18 + pgvector (Docker), schema `ws_<workspace>`, postgres.js
- **Graph RAG:** `ts_rank` + pgvector cosine (bge-small) + recursive CTE over references
- **Ranking:** product_impact + timeline_impact + unlocks (0–5, author-set), generated on index update; earliest wins ties
- **Cross-project feed:** `UNION ALL` of enabled schemas; counters by state
- **Metrics:** consistency = share of entities whose references resolve; open issues = unverified Issue, Conflict; bugs = Product/Bug not verified and synced; defects = unverified validation issues
- **Harness settings:** schema `harness`; enabling makes no commits
