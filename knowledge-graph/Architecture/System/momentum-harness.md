---
type: Architecture/System
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 3
references:
  - to: Code/Repository/momentum
    relation: hosted_in
  - to: Infrastructure/Environment/dedicated-machine
    relation: runs_on
artifacts:
  - docs/diagrams/01-layers.md
  - docs/diagrams/02-deployment.md
---
# Momentum harness system

Three layers: attention on top (ranked feed and approval, shared across projects), understanding beneath (entities and index), implementation at the base (automations, runs, validation); the lower two exist once per project.

```mermaid
flowchart LR
  App["App: web + mobile"] -->|polls over the mesh| API
  subgraph Backend["One back-end process"]
    API --> Orch["Orchestrator"]
    Guard["Consistency guard"]
  end
  Orch --> Runs["Claude Code run processes"]
  Runs --> KB["Knowledge base + index, per workspace"]
  Guard --> KB
```
