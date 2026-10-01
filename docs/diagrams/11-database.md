# Database

Source: [SPEC.md → Database](../SPEC.md#database)

```mermaid
classDiagram
  class entity {
    path
    type
    title
    card
    origin
    verification
    sync
    contradictions
  }
  class entity_artifact {
    entity_path
    artifact_path
  }
  class entity_reference {
    from_path
    to_path
    relation_type
  }
  class chat {
    entity_path
    run_id
  }
  class automation {
    name
    responsibility
    definition
    trigger
  }
  class run {
    id
    automation
    checkout
    trigger
    target_path
  }
  class attention_ranking {
    entity_path
    product_impact
    timeline_impact
    unlocks
    rank
  }
  class attention_metric {
    entity_path
    time_spent
    reaction
    recorded_at
  }
  class attention_pattern {
    pattern
    outcome
  }
  class understanding_metric {
    consistency
    recorded_at
  }
  class agent_metric {
    run_id
    misalignments
    recurring_issues
    variant
    usage
    recorded_at
  }
  class implementation_metric {
    outstanding_issues
    bugs
    defects
    recorded_at
  }
  entity_artifact --> entity : entity_path
  entity_reference --> entity : from_path
  entity_reference --> entity : to_path
  chat --> entity : entity_path
  chat --> run : run_id
  run --> automation : automation
  run --> entity : target_path
  attention_ranking --> entity : entity_path
  attention_metric --> entity : entity_path
  agent_metric --> run : run_id
```
