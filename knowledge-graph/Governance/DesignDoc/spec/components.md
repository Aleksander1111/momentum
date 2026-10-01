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

Three layers carry the user: attention on top, understanding beneath, implementation at the base. The attention layer is shared; everything beneath exists once per project.

```mermaid
flowchart TD
  FE[Front-end: web + mobile app] --> API
  subgraph Back-end
    API --> ORC[Orchestrator]
    API --> FEED[Attention feed]
    ORC --> AUT[Automations]
    AUT --> KB[Knowledge base]
    KB --> G[Consistency guard] --> DB[Index and metrics database]
    DB --> FEED
  end
```
