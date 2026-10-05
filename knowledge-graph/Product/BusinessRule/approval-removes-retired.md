---
type: Product/BusinessRule
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Plan/retire-implementation-plan
    relation: implements
  - to: Harness/Automation/retention
    relation: concerns
artifacts:
  - apps/backend/src/approval.ts
  - automations/retention/agents/momentum-retention.md
  - automations/chat/agents/momentum-chat.md
---
# Approval removes retired entities

A retirement is a Harness/Plan with a `retires` reference to each entity it retires; retention and chat write it, leaving the files in place.

- Approving it makes one commit deleting each `retires` target still standing, unless something else references it; a Harness/Chat, or an entity written with the retirement, keeps nothing alive and drops its reference
- A plan that retires and plans nothing else is carried out, then deleted; others drop references to what went
- Commit: "Approve <title>", then "Retire <path>" or "Keep <path>: still referenced by …" per target
- The main line is reindexed, so retired entities leave index and feed
- The approval goes on the timeline with its effects
