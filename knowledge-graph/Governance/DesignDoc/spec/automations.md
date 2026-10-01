---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/mapping
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Spec: automations

Defined by responsibility alone; definitions live in the harness workspace, triggers per workspace. AI only for judgement.

| Automation | Responsibility |
|---|---|
| Exploration | Next best action within goals |
| Preparation | Plans under plans/ |
| Consistency check | Issues as entities |
| Retention | Retire spent entities by type rules |
| Implementation | Own branch, merged once validated |
| Validation | Changes and product; gates merge |
| Optimization | Recurring issues → definition changes |
| Summarization | Harness step after every run; no trigger |
| Chat | Started by the user |
| Mapping | Builds the graph when enabled |
