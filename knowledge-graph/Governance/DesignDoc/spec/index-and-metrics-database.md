---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/spec/knowledge-base
    relation: part_of
  - to: Harness/Automation/optimization
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Index and metrics database

The queryable side of the knowledge base: indices over entities, automations and chats, one store per workspace on the dedicated machine, kept current by the consistency guard.

| Metrics | Tracks |
|---|---|
| Attention | Time per item, reactions, patterns to auto-approve or reject |
| Understanding | Knowledge base consistency and its trend |
| Agents | Chat misalignments, recurring issues, run-over-run behaviour |
| Implementation | Outstanding issues, bugs, defects |

All tracked over time and fed to optimization. Usage is known at any moment as percent of the 5-hour and weekly limits. Holds the attention ranking the API reads per poll.
