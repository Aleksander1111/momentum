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
  - to: Governance/DesignDoc/plan/work-package-scope
    relation: contains
artifacts:
  - docs/PLAN.md
---
# Plan: work packages

```plantuml
left to right direction
[1 Contract] as C
[2 Entity] as E
[3 KB] as K
[4 Runs] as R
[5 Guard] as G
[6 Orchestrator] as O
[7 API] as A
[8 Automations] as U
[9 App] as P
[10 Metrics] as T
[11 End-to-end] as V
[0 Machine]-->R
C-->E
E-->K
E-->G
K-->G
R-->G
R-->O
G-->O
C-->A
K-->A
O-->A
K-->U
R-->U
C-->P
A-->P
K-->T
G-->T
A-->T
P-->V
T-->V
U-->V
```
