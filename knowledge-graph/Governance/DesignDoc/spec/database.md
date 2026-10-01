---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
artifacts:
  - docs/SPEC.md
---
# Spec: index and metrics database

One store per workspace on the dedicated machine, updated by the guard on every validated transaction.

| Group | Tables |
|---|---|
| Entities | entity, entity_artifact, entity_reference, chat |
| Runs | automation, run, usage_share |
| Attention | attention_ranking, attention_metric, attention_pattern |
| Metrics | understanding, agent, implementation |

Usage is percentage points of the 5-hour and weekly limits, split evenly among concurrent runs. Ranking is precomputed so polls do no work.
