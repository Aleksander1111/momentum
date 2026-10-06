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

Three layers: attention (shared), understanding and implementation (per project); a border splits unverified from verified.

```plantuml
[User] --> [Attention feed]
[Entity cards] --> [Ranking]
[Ranking] --> [Attention feed]
[Attention feed] --> [Approval]
[Approval] --> [Knowledge graph]
[Entity cards] <--> [Consistency guard]
[Consistency guard] <--> [Knowledge graph]
[Knowledge graph] --> [Orchestrator]
[Orchestrator] --> [Automations]
[Automations] --> [Artifacts]
[Artifacts] --> [Summarization]
[Summarization] --> [Entity cards]
```

Harness: feed, explorer, chat, timeline, metrics, settings; API, orchestrator, runner, consistency guard.
