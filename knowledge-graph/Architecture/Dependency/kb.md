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

- Postgres DDL: harness schema; per workspace: entities (card diff, state history), runs, messages, transactions, attention, patterns, metrics, usage
- Index: upsert, references both ways, types tree, full text + pgvector fused by reciprocal rank (a question matches any word), expanded along references
- Version: hash of title, card, issue options; contradictions from open issues
- Feed across projects by rank; state counts; reactions
- bge-small embeddings (cache MOMENTUM_MODELS), retried on failed load
- `momentum-kb` MCP: search, read, references, types, write (named entities linked and referenced), record_agent_metric
