---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 3
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Data/Database/index-and-metrics-database
    relation: reads
artifacts:
  - apps/backend/src/approval.ts
  - docs/diagrams/09-attention-feed.md
---
# Attention feed

One feed across enabled projects where everything that needs the user's attention shows up as an entity.

- Rank = product_impact + timeline_impact + unlocks, integers 0–5 from the entity; ties go to the item that entered first; no project priority
- The API merges the per-workspace rankings with one UNION ALL; no work per poll
- Approve commits the entity to the main line as verified; send back starts a chat run on its branch with the comment
- Feed size (40 by default) bounds the loops: at the limit they pause until the user works it down
- Reactions and time per item are attention metrics; ten equal reactions in a row on one type become a pattern
