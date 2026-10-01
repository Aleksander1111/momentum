---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references: []
artifacts:
  - docs/PLAN.md
---
# Data, retrieval and ranking

- **Database:** Postgres 18 in Docker (`pgvector/pgvector:pg18-trixie`), database `momentum`, schema `ws_<workspace>`, postgres.js; `tsvector` + GIN
- **Graph RAG:** `ts_rank` full text + pgvector cosine + recursive CTE over `entity_reference`; bge-small (ONNX) embeddings in-process
- **Ranking:** rank = product_impact + timeline_impact + unlocks (0–5 each, set by the author), generated column; ties to first in feed
- **Cross-project feed:** `UNION ALL` of enabled projects' rankings; counters by verification and sync state
- **Harness settings:** schema `harness` (projects and build state, feed size, lifetimes, cards, models, usage…), so enabling a project creates no commits in it
