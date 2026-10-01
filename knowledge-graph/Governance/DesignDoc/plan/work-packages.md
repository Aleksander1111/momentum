---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 5
unlocks: 5
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Plan: work packages

```mermaid
flowchart LR
  M[0 Machine] --> R[4 Runs]
  C[1 Contract] --> E[2 Entity] --> K[3 KB]
  E & K & R --> G[5 Guard]
  R & G --> O[6 Orchestrator]
  C & K & O --> A[7 API]
  K & R --> Au[8 Automations]
  C & A --> App[9 App]
  K & G & A --> Me[10 Metrics]
  App & Me & Au --> V[11 End-to-end]
```

- 3 KB: full text, pgvector, `momentum-kb` MCP server
- 4 Runs: worktree, SDK session, usage as share of limits
- 5 Guard: hooks, validation, issue entities, sync state
- 8 Automations: eleven definitions, default triggers for the eight started by schedule, event or on demand
- 11: this repository runs as a live workspace
