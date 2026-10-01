---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Data, retrieval and ranking

- **Database:** Postgres 18 in Docker (`pgvector/pgvector:pg18-trixie`), database `momentum`, schema `ws_<workspace>`, postgres.js
- **Graph RAG:** `ts_rank` full text + pgvector cosine + recursive CTE over `entity_reference`; bge-small embeddings in-process
- **Ranking:** rank = product_impact + timeline_impact + unlocks (0–5 each), generated column; ties to first in feed
- **Cross-project feed:** `UNION ALL` of enabled workspaces' rankings; counters by verification and sync state
- **Harness settings:** schema `harness`, so enabling a project creates no commits in it
