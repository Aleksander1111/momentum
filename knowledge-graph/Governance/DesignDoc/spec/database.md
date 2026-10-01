---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/optimization
    relation: concerns
artifacts:
  - docs/SPEC.md
  - docs/diagrams/11-database.md
---
# Database

Index and metrics store, one per workspace, updated by the consistency guard on every validated transaction.

| Group | Tables |
|---|---|
| Index | entity (path, type, title, card, origin, verification, sync), entity_artifact, entity_reference, chat |
| Runs | automation, run (branch, checkout, trigger, target, usage) |
| Attention | attention_ranking (feed rank), attention_metric, attention_pattern |
| Metrics | understanding_metric, agent_metric (variant, usage), implementation_metric |

- Summary = entity with an entity_artifact row
- sync: synced · entity_ahead · artifact_ahead · updating
- Usage in % of the 5-hour and weekly limits
