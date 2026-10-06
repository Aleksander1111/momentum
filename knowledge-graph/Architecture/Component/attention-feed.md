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

One feed across enabled projects: everything needing the user's attention, as entities.

- Rank = product_impact + timeline_impact + unlocks; the feed size bounds the loops
- Approve: one commit sets it verified, deletes what it `retires` unless referenced, syncs what it `implements`
- Send back: the comment starts a chat run on the entity, or joins the open one
- Resolve an issue: a picked option or the user's text starts a chat run
- Won't resolve: verified, with the reason
- Ten alike reactions to one type propose a Harness/Pattern
- One reaction at a time per entity; the same one twice acts once
- An entity a chat left unverified comes back
- Each goes on the timeline
