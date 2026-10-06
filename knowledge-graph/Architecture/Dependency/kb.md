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

- Postgres DDL: harness schema (projects, settings, credential, sessions, usage, voice cursor, run refs); per workspace: entities, runs, messages, chats, transactions, attention, metrics, usage shares; checks from the contract; pruning
- Index: an entity's rows change in one transaction; references both ways, state history, types tree, full text + pgvector fused by rank, expanded along references
- Version: hash of title, card, issue options; contradictions from open issues
- Cross-project feed by rank; state counts; reactions
- bge-small embeddings, retried on failure
- MCP: search, read, references, types, write, record_agent_metric
