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

- Postgres DDL: harness schema and one per workspace: entities with card diff and state history, runs, messages with context, transactions, attention, metrics, usage shares
- Workspace index: upsert, references both ways, types tree, full text + pgvector search fused by reciprocal rank, expanded along references
- Contradictions recounted from open contradiction issues' `concerns`
- Cross-project feed by rank, with card diffs, issue options and concerned entities; state counts; reactions with time spent
- bge-small embeddings in-process
- `momentum-kb` MCP server: search, read, references, write, record_agent_metric
