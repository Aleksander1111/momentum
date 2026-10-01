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

- **Database:** Postgres 18 in Docker (`pgvector/pgvector:pg18-trixie`), database `momentum`, schema `ws_<workspace>`, postgres.js; `tsvector` + GIN
- **Graph RAG:** `ts_rank` + pgvector cosine + recursive CTE over `entity_reference`; bge-small (ONNX) embeddings in-process
- **Ranking:** rank = product_impact + timeline_impact + unlocks (0–5, author-set), generated on index update; ties to first in feed
- **Cross-project feed:** `UNION ALL` of enabled projects' rankings; counters by verification and sync state
- **Harness settings:** schema `harness` (projects and build state, feed, lifetimes, cards, unsummarized paths, models, run workspaces, usage), so enabling a project makes no commits
