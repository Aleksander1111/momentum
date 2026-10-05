---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Component/runner
    relation: exposed_by
  - to: Architecture/Component/knowledge-base
    relation: accesses
  - to: Architecture/Dependency/kb
    relation: implemented_in
artifacts:
  - packages/kb/src/mcp.ts
---
# momentum-kb MCP server

In-process MCP server the SDK gives every run: the knowledge base of the run's workspace, `packages/kb/src/mcp.ts`.

| Tool | Does |
|---|---|
| search | Full text + semantic, expanded along references |
| read | An entity from the run's checkout, else from the index |
| references | Both directions, with relation and titles |
| types | Entity types by path |
| write | Writes `knowledge-graph/<path>.md` in the run checkout, entities linked where named and referenced; returns validation issues |
| record_agent_metric | Misalignments and recurring issues found by the run |
