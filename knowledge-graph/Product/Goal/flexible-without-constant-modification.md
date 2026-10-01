---
type: Product/Goal
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/optimization
    relation: served_by
artifacts:
  - docs/SPEC.md
---
# Flexible enough to keep working

Success criterion from the spec: the system is flexible enough that it does not need constant modification to keep working.

- Automations defined by responsibility alone; no entity type belongs to one
- Definitions (harness workspace) and triggers (per workspace) are entities, edited or proposed and approved through the feed
- Optimization proposes skills, sub-agents, definitions and tools from recurring issues; competing variants compared on metrics
- Approved definitions materialized into each workspace for Claude Code
- Concurrency tuned from measured behaviour, not fixed upfront
- AI only for judgement; indices, metrics, lifetimes and references are queries and rules
