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
  - to: Governance/DesignDoc/plan/mapping
    relation: continues_in
  - to: Governance/DesignDoc/plan/models
    relation: continues_in
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Implementation decisions

- Triggers: exploration every 2 h, preparation at half past; validation 02:00 and on `implementation_finished`; consistency check 03:00, retention 04:00, optimization 05:00; implementation on `entity_ahead`; all on demand; a trigger counts once approved
- Artifact change: a summarization run, no trigger
- Chat: a message after the run ended resumes it on a fresh checkout; transcript `chats/<run-id>.jsonl`
- Checkouts: made at the main-line tip, removed once landed; legacy `momentum/*` branches landed at startup
- Usage: per run from its first reading; per workspace the sum, over the rolling 5 h and week
- Attention patterns: ten reactions to one type all alike; recorded, not applied
