---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/retention/agents/momentum-retention.md
  - automations/retention/trigger.md
---
# Retention

Retires entities from the main line once their lifetime is spent.

- Lifetime follows rules per entity type, given in the run context: the user's decision, applied without asking
- An entity something still references is not spent
- Deletes each spent entity's file and drops the references to it; the harness reports what went on a Harness/Report card in the feed and on the run's timeline event
- Never retires goals, automations or triggers
- Found nothing spent: writes nothing
