---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/preparation
    relation: concerns
  - to: Harness/Automation/mapping
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Spec: automations

Per-project loops defined by responsibility alone: a definition entity in the harness workspace, a trigger entity per workspace (none for a step). AI only for judgement.

| Automation | Responsibility |
|---|---|
| Exploration | Next best action within goals |
| Preparation | Unlimited plan files under plans/ |
| Consistency check | Issues as entities |
| Retention | Retire spent entities by type rules |
| Implementation | Own branch, merged once validated |
| Validation | Product and changes; gates merge |
| Optimization | Chat issues → definition changes |
| Summarization | Harness step after every run; no trigger |
| Chat | Started by the user |
| Mapping | Builds the graph once enabled |
