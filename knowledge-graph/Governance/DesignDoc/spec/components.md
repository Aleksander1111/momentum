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
  - docs/slides/slide-1.png
---
# Components

Harness and products. The user enters through the attention feed. Three layers: attention (shared), knowledge and product (per project); a consistency border splits unverified from verified.

```plantuml
[Triggers] as T
[Exploration, preparation, implementation, testing, review] as A
[Story, plan, change, bug, refactor] as R
[Summarizer] as S
[Entity cards] as C
[Consistency gate] as G
[Knowledge graph] as K
[Prioritizer] as P
[Attention feed] as F
[Retention] as N
A<--T
R<--A
S<--R
C<--S
G<-->C
K<-->G
P<--C
F<--P
N<--F
K<--N
T<--K
F<--[User]
```
Harness: settings, graph explorer, importance rank, chat, metrics, optimization, orchestrator, API, voice tools, RAG.
