---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Code/Repository/momentum
    relation: part_of
  - to: Architecture/Dependency/entity
    relation: depends_on
  - to: Data/Database/index-and-metrics-database
    relation: depends_on
artifacts:
  - packages/kb/src/db.ts
  - packages/kb/src/workspace-index.ts
  - packages/kb/src/embeddings.ts
  - packages/kb/src/mcp.ts
kind: internal library
---
# kb package

`@momentum/kb`, internal library: the index side of the knowledge base.

- Postgres connection and the DDL of the harness and workspace schemas
- Workspace index: upsert, detail with references both ways, types tree, full text (`ts_rank`) + pgvector cosine search fused by reciprocal rank and expanded along references (recursive CTE), attention ranking and reactions, cross-project feed
- Embeddings computed in-process with `@huggingface/transformers` (bge-small, ONNX, 384 dimensions)
- The `momentum-kb` MCP server given to every run
