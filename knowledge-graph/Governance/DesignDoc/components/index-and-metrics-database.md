---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/components/knowledge-base
    relation: part_of
  - to: Governance/DesignDoc/components/attention-feed
    relation: concerns
  - to: Harness/Automation/optimization
    relation: concerns
artifacts: []
---
# Index and metrics database

Indices over entities, automations and chats, per workspace on the dedicated machine, kept current by the guard.

| Metrics | Tracks |
|---|---|
| Attention | time per item, approvals, rejections, send-backs, patterns |
| Understanding | knowledge-base consistency over time |
| Agents | chat misalignments, recurring issues, run behaviour |
| Implementation | outstanding issues, bugs, defects |

All feed optimization; unmeasured counts are no data, not zero. Keeps each entity's state history and what single runs used. Usage is % of the 5-hour and weekly limits, split among concurrent runs. Holds the ranking the API reads directly.
