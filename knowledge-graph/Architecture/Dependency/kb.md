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

- Postgres DDL: harness schema and one per workspace; contract checks; pruning
- Index: an entity's rows change in one transaction; references both ways, state history, types tree; full text + pgvector fused by rank, widened along references; same planned work; by artifact (a listed directory claims all in it); claims for the completeness measure
- Version: hash of title, card, issue options; contradictions
- Cross-project feed by rank, issues titled by what they concern; state counts; reactions
- bge-small embeddings, retried
- MCP: search, read, references, types, write, record_agent_metric
