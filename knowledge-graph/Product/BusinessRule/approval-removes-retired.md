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

A retirement is a Harness/Plan with a `retires` reference to each entity it retires; retention and chat write retirements this way, and the chat deletes the retired files.

- Approving the plan makes one commit on the main line: the plan verified, and every `retires` target still standing there deleted, whether or not the run already deleted it
- The commit message: "Approve <title>", then "Retire <path>" per retired entity
- The main line is reindexed after the commit, so retired entities leave the index and the feed with the same change
- The approval goes on the timeline with each removal as its detail
