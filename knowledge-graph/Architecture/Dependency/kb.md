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

- Postgres DDL: harness schema (voice cursor); per workspace: entities with card diff and state history, runs with interview state and extra targets, messages, transactions, attention, metrics, usage
- Workspace index: upsert, references both ways, referrers, types tree, full text + pgvector search fused by reciprocal rank, expanded by references
- Version: hash of title, card, issue options
- Contradictions from open issues
- Feed across projects by rank: versions, card diffs, issue options, concerned entities; state counts; reactions
- bge-small embeddings
- `momentum-kb` MCP: search, read, references, write, record_agent_metric
