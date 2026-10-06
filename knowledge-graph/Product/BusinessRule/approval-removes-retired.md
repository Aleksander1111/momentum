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
# Approval removes retired entities

A Harness/Plan with a `retires` reference per entity, written by the user, removes them on approval. Runs never write one: what a run removes is removed, and a Harness/Report card says what went.

- Approving makes one commit deleting each `retires` target unless something else references it; a Harness/Chat, or an entity written with the retirement, keeps nothing alive
- A plan that only retires is carried out, then deleted; others drop references to what went
- Commit: "Approve <title>", then "Retire <path>" or "Keep <path>: referenced by …"
- Approving twice does nothing; a card changed since shown conflicts
- The main line is reindexed; the approval goes on the timeline with its effects
