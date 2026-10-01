---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 3
unlocks: 2
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/mapping
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
- An artifact change starts summarization directly; mapping starts on enable; neither has a trigger
- Chat stays open 10 min; transcript `chats/<run-id>.jsonl`
- Mapping: one branch, runs bounded by feed room, coverage via `report_mapping`; stop, resume, two-tap reset
- Models: one, per automation, or by implementation risk (Haiku + `risk.md`)
- Usage as shares of the 5-hour and weekly limits; checkouts go with their branch
