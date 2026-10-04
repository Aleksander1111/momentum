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
---
# Attention feed

One feed across enabled projects where everything needing the user's attention shows up as an entity.

- Rank = product_impact + timeline_impact + unlocks; the feed size bounds the loops
- Approve: one commit sets it verified, deletes what it `retires` unless still referenced, syncs what it `implements`
- Send back: the comment starts a chat run on the entity, or joins the one open on it
- Resolve an issue: a picked option or the user's text starts a chat run that applies it and retires the issue
- Won't resolve: verified, with the reason
- One reaction at a time per entity; the same one twice acts once
- Each goes on the timeline with effects, comment, run and time spent
