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
artifacts: []
---
# Implementation decisions

- Triggers: exploration every 2 h, preparation at half past; validation 02:00 and on `implementation_finished`; consistency 03:00, retention 04:00, optimization 05:00; implementation on `entity_ahead`; on demand; once approved
- Artifact change: a summarization run, no trigger
- Chat: a message after the run ended resumes it on a fresh checkout; transcript `chats/<run-id>.jsonl`
- Checkouts: detached at the main-line tip, removed once landed
- Usage: per run from its first reading; per workspace the sum
- Attention patterns: ten alike reactions to a type proposed as a Harness/Pattern; accepted when approved, not applied
- One chat teaches nothing: optimization proposes what repeats thrice
