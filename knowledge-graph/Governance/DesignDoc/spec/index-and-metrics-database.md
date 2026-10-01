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
artifacts:
  - docs/SPEC.md
---
# Index and metrics database

The queryable side of the knowledge base: indices over entities, automations and chats, one store per workspace, updated by the consistency guard on every change.

| Metrics | Tracks |
|---|---|
| Attention | Time per item, reactions, auto-approve/reject patterns |
| Understanding | Knowledge base consistency |
| Agents | Misalignments, recurring issues, run-over-run behaviour |
| Implementation | Outstanding issues, bugs, defects |

All tracked over time and fed to optimization. Usage is known at any moment as percent of the 5-hour and weekly limits, per workspace and run; each rise is split evenly among concurrent runs. Holds the attention ranking the API reads per poll.
