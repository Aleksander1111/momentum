---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 3
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Data/Database/index-and-metrics-database
    relation: reads
  - to: Harness/Automation/chat
    relation: starts
artifacts:
  - apps/backend/src/approval.ts
  - docs/diagrams/09-attention-feed.md
---
# Attention feed

One feed across enabled projects where everything needing the user's attention shows up as an entity.

- Rank = product_impact + timeline_impact + unlocks; ties to the earlier entry; the feed size bounds the loops
- Approve: one commit on the main line sets the entity verified, deletes what it `retires`, sets what it `implements` synced
- Send back: the comment starts a chat run targeting the entity
- Resolve an issue: a picked option (approved) or the user's text (sent back) starts a chat run that applies it to the concerned entities and retires the issue
- Won't resolve: a commit sets it verified with the reason; rejected
- Each reaction records the time spent
