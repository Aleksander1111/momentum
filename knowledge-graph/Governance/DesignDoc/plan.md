---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 5
unlocks: 5
references:
  - to: Governance/DesignDoc/plan/technology
    relation: includes
  - to: Governance/DesignDoc/plan/repository-and-entities
    relation: includes
  - to: Governance/DesignDoc/plan/approval
    relation: includes
  - to: Governance/DesignDoc/plan/pages
    relation: includes
  - to: Governance/DesignDoc/plan/implementation-decisions
    relation: includes
artifacts:
  - docs/PLAN.md
---
# Momentum implementation plan

Builds the harness in one pass: twelve work packages ordered by dependency, from SPEC.md, entity types, diagrams and page designs.

```mermaid
flowchart LR
  P0[Machine]-->P4[Runs]
  P1[Contract]-->P2[Entity]-->P3[KB]
  P2 & P3 & P4-->P5[Guard]
  P4 & P5-->P6[Orchestrator]
  P1 & P3 & P6-->P7[API]
  P3 & P4-->P8[Automations]
  P1 & P7-->P9[App]
  P3 & P5 & P7-->P10[Metrics]
  P9 & P10-->P11[End-to-end]
```

Still open: tuning and measuring the attention ranking; scale, latency and usage targets. Assumed, not verified: procgov limits hold for the Claude Code subprocess tree.
