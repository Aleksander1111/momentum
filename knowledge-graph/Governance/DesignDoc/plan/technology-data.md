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

- **Entities:** markdown at `knowledge-graph/<type path>/<name>.md`; frontmatter holds type, references, ranking; body is the card
- **Validator:** unified with remark-parse, -gfm, -frontmatter; enforces the card limit, resolves references
- **Store:** Postgres 18 + pgvector in Docker, one schema `ws_<workspace>` each, postgres.js; tsvector + GIN search; settings in schema `harness`
- **Retrieval:** ts_rank + pgvector cosine + recursive-CTE reference traversal; bge-small embeddings in-process
- **Ranking:** product_impact + timeline_impact + unlocks (0–5 each) as a generated column; ties to the earlier feed entry
- **Feed:** one `UNION ALL` over enabled projects' schemas per request
