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
artifacts: []
---
# Spec: index and metrics database

One store per workspace on the dedicated machine, updated by the guard on every validated transaction.

| Group | Tables |
|---|---|
| Entities | entity, entity_state, entity_artifact, entity_reference, chat |
| Runs | automation, run, usage_share |
| Attention | attention_ranking, attention_metric, attention_pattern |
| Metrics | understanding, agent, implementation |

An entity carries its contradictions, counted from references; one with an artifact row is a summary. entity_state logs each verification and sync change, none once the entity is gone. Usage is percentage points of the 5-hour and weekly limits, split evenly among concurrent runs. Ranking is precomputed so polls do no work.
