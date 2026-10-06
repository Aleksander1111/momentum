---
type: Product/BusinessRule
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references: []
artifacts:
  - apps/backend/src/approval.ts
---
# Approval verifies and removes nothing

Approving an entity in the feed is the user's review of it, nothing more. A `retires` reference no longer removes anything on approval: what a run removes it deletes itself, and a Harness/Report says what went.

- One commit, "Approve <title>": the entity becomes verified and its sync is recomputed
- Each entity it `implements` (and what an implemented Harness/Plan `plans`) is set synced: "Bring <path> back in sync"
- Approving twice does nothing; a card changed since it was shown conflicts
- Approving a definition triggers nothing; the main line is reindexed and the approval goes on the timeline
