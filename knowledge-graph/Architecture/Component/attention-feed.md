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
  - to: Product/BusinessRule/approval-removes-retired
    relation: applies
artifacts:
  - apps/backend/src/approval.ts
---
# Attention feed

One feed across enabled projects: all that needs the user, as entities.

- Rank = product_impact + timeline_impact + unlocks; the feed size bounds the loops
- [Approve](Product/BusinessRule/approval-removes-retired): one commit sets it verified, syncs what it `implements`, removes nothing
- Send back: the comment starts a chat run on the entity, or joins the open one
- Resolve an issue: a picked option or the user's text starts a chat run
- Won't resolve: verified, with the reason
- Ten alike reactions to one type propose a Harness/Pattern
- One reaction at a time per entity; the same one twice acts once
- An entity a chat left unverified comes back
- Each goes on the timeline
