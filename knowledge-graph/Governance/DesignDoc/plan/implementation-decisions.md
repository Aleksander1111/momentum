---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 3
unlocks: 2
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Implementation decisions

- Triggers: exploration and preparation every two hours; validation, consistency check, retention, optimization nightly; implementation on `entity_ahead`; all on demand
- Summarization and mapping have no trigger entity: the harness starts them
- A chat stays open ten minutes; transcript at `chats/<run-id>.jsonl`
- Mapping continues run after run on one branch, bounded by feed room, reporting coverage; stop, resume, reset
- Models: one for all, per automation, or by implementation risk judged by Haiku from `risk.md`
- Usage per run and workspace as shares of the 5-hour and weekly limits
