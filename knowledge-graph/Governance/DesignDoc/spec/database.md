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

One store per workspace, updated by the guard on every transaction, beside the harness schema.

| Group | Tables |
|---|---|
| Entities | entity, entity_state, entity_artifact, entity_reference, chat |
| Runs | automation, run, run_message, transaction, usage_share |
| Attention | attention_ranking, attention_metric, attention_pattern |
| Metrics | understanding, agent, implementation |
| Harness | project, setting, credential, session, usage_sample, voice_cursor, run_ref, timeline_event |

One with an artifact row is a summary. entity_state logs each state change, and one last null row once the entity is gone. Usage is percentage points of the limits, split among concurrent runs.
