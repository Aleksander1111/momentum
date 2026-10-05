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

`@momentum/kb`: the index side of the knowledge base.

- Postgres DDL: harness schema (voice cursor); per workspace: entities (card diff, state history), runs (interview state, extra targets), messages, transactions, attention, metrics, usage
- Index: upsert, references both ways, types tree, full text + pgvector search fused by reciprocal rank, expanded along references
- Version: hash of title, card, issue options; contradictions from open issues
- Feed across projects by rank: versions, card diffs, issue options; state counts; reactions
- bge-small embeddings (cache MOMENTUM_MODELS), retried on failed load
- `momentum-kb` MCP: search, read, references, types, write, record_agent_metric
