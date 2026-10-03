---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/components/front-end
    relation: concerns
  - to: Governance/DesignDoc/components/api
    relation: concerns
  - to: Governance/DesignDoc/components/orchestrator
    relation: concerns
  - to: Governance/DesignDoc/components/knowledge-base
    relation: concerns
  - to: Governance/DesignDoc/components/automations
    relation: concerns
  - to: Governance/DesignDoc/components/attention-feed
    relation: concerns
artifacts:
  - docs/SPEC.md
  - docs/slides/slide-1.png
---
# Components

Harness and products. The user enters through the attention feed. Three layers: attention (shared), knowledge and product (per project); a consistency border splits unverified from verified.

```mermaid
flowchart BT
  T[Triggers] --> A[Exploration, preparation, implementation, testing, review]
  A --> R[Story, plan, change, bug, refactor] --> S[Summarizer] --> C[Entity cards]
  C <--> G[Consistency gate] <--> K[Knowledge graph]
  C --> P[Prioritizer] --> F[Attention feed]
  F --> RT[Retention] --> K --> T
  U[User] --> F
```
Harness: settings, graph explorer, importance rank, chat, metrics, optimization, orchestrator, API, voice tools, RAG.
