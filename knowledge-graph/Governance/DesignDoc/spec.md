---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec/components
    relation: includes
  - to: Governance/DesignDoc/spec/knowledge-base
    relation: includes
  - to: Governance/DesignDoc/spec/automations
    relation: includes
  - to: Governance/DesignDoc/spec/attention-feed
    relation: includes
  - to: Governance/DesignDoc/spec/database
    relation: includes
  - to: Governance/DesignDoc/spec/deployment
    relation: includes
artifacts:
  - docs/SPEC.md
---
# Momentum harness spec

Orchestrator and single entry point between the user and the work around each project, explored through entities instead of raw artifacts.

| Layer | Carries |
|---|---|
| Attention | Ranked feed, approval |
| Understanding | Entities, index |
| Implementation | Automations, runs, validation |

- Workspace = git repo on one machine, with its own knowledge base and goals
- Single user, projects isolated, 5–20 enabled at once
- Nothing counts until the guard validates it and the user approves it
- Success: consistency grows, work arrives whole, no constant modification

Parts: components, knowledge base, automations, attention feed, database, deployment.
