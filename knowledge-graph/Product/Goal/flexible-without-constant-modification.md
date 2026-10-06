---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/optimization
    relation: served_by
  - to: Harness/Automation/exploration
    relation: guides
artifacts: []
---
# Flexible enough to keep working

Success criterion: the system does not need constant modification to keep working.

- Automations defined by responsibility alone; no entity type belongs to one
- Definitions (harness workspace) and triggers (per workspace) are entities, edited or proposed, reviewed in the feed
- Optimization proposes skills, sub-agents, definitions and tools from recurring issues; variants compared on metrics
- Definitions materialized into each workspace as they stand on the harness main line
- Summarization runs from a Stop hook, so no work waits on the feed limit
- Concurrency a setting, set from the usage Metrics show
- AI only for judgement; the rest is queries and rules
