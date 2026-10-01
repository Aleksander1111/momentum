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

- Postgres connection and DDL: harness schema, and per workspace entities, runs (with model and risk), transactions and metrics
- Workspace index: upsert, references both ways, types tree, full text + pgvector search fused by reciprocal rank and expanded along references, attention ranking, cross-project feed and counts
- In-process embeddings: bge-small over ONNX, 384 dimensions
- The `momentum-kb` MCP server given to every run
