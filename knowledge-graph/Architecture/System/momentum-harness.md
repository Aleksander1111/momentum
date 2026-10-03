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

```plantuml
left to right direction
rectangle "App: web + mobile" as App
rectangle "One back-end process" {
  rectangle API
  rectangle "Orchestrator" as Orch
  rectangle "Consistency guard" as Guard
}
rectangle "Claude Code run processes" as Runs
rectangle "Knowledge base + index, per workspace" as KB
App --> API : polls over the mesh
API --> Orch
Orch --> Runs
Runs --> KB
Guard --> KB
```
