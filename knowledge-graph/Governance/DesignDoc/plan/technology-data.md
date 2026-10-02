---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Technology: knowledge base and index

- **Entities:** markdown at `knowledge-graph/<type path>/<name>.md`; frontmatter: type, references, ranking; body: the card
- **Validator:** unified (remark-parse, -gfm, -frontmatter); card limit, references
- **Store:** Postgres 18 + pgvector in Docker, schema `ws_<workspace>`, postgres.js; tsvector + GIN; `harness` schema for settings
- **Retrieval:** ts_rank + pgvector cosine + recursive-CTE reference traversal; bge-small embeddings in-process
- **Ranking:** product_impact + timeline_impact + unlocks (0–5 each) as a generated column; ties to the earlier feed entry
- **Feed:** one `UNION ALL` over enabled schemas, a second for the counters
