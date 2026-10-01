---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 3
unlocks: 2
references:
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Implementation decisions

- Triggers: exploration every 2 h, preparation at half past; validation 02:00 and on `implementation_finished`; consistency 03:00, retention 04:00, optimization 05:00; implementation on `entity_ahead`; all on demand
- Summarization and graph build have no trigger entity
- Chat open 10 min after last answer; transcript `chats/<run-id>.jsonl`
- Graph build: one branch, runs bounded by feed room, coverage via `report_graph_build`; stop, resume, two-tap reset
- Models: one, per automation, or by implementation risk (Haiku + `risk.md`)
- Usage over rolling 5 h and week; checkouts go with their branch
- Attention patterns: 10 same reactions per type, recorded only
