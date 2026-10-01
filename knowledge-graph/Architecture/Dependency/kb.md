---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references: []
artifacts:
  - packages/kb/src/index.ts
  - packages/kb/src/db.ts
  - packages/kb/src/workspace-index.ts
  - packages/kb/src/embeddings.ts
  - packages/kb/src/mcp.ts
kind: internal library
---
# kb package

`@momentum/kb`, internal library: the index side of the knowledge base.

- Postgres DDL: harness schema with projects, settings, login and usage samples; per workspace, entities, runs with model, risk and usage, transactions, attention, agent metrics and per-run usage shares; renames mapping to graph-build
- Workspace index: upsert, references both ways, types tree, full text + pgvector search fused by reciprocal rank and expanded along references, attention ranking, cross-project feed and state counts
- In-process embeddings: bge-small over ONNX, 384 dimensions
- `momentum-kb` MCP server for every run: search, read, references, validated write to the run's checkout, record_agent_metric
