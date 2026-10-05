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

A retirement is a Harness/Plan with a `retires` reference to each entity it retires; retention and chat write it and leave the files in place.

- Approving it makes one commit: each `retires` target still standing is deleted, unless something else references it; a chat's record (Harness/Chat), or an entity written in the same commit as the retirement (the tasks a task was split into), keeps nothing alive and drops its reference instead
- A plan that retires and plans no other work (no `plans` reference) is carried out then and deleted with them; another entity drops its references to what went
- Commit message: "Approve <title>", then "Retire <path>" or "Keep <path>: still referenced by …" per target
- The main line is reindexed after the commit, so retired entities leave the index and feed with it
- The approval goes on the timeline with each effect as its detail
