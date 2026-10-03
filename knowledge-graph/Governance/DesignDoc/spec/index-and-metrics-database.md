---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/optimization
    relation: concerns
artifacts: []
---
# Index and metrics database

The queryable side of the knowledge base: indices over entities, automations and chats, one store per workspace, updated by the guard on every change.

| Metrics | Tracks |
|---|---|
| Attention | Time per item, reactions, auto-approve/reject patterns |
| Understanding | Knowledge base consistency |
| Agents | Misalignments, recurring issues, run-over-run behaviour |
| Implementation | Outstanding issues, bugs, defects |

Tracked over time, fed to optimization; unmeasured counts are no data. Keeps every entity's state history and each run's usage, time and messages. Usage is % of the 5-hour and weekly limits, split among concurrent runs. Holds the ranking the API reads per poll.
