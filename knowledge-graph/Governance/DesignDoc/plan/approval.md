---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 4
references: []
artifacts:
  - docs/PLAN.md
---
# Plan: approval and send back

- Two states: `verification` (user's judgement) and `sync` (entity against its artifact)
- Approve commits the entity verified to main with what it retires (removed) and implements (`synced`)
- Approved implementable entity without `implements` becomes `entity_ahead`
- Send back starts a chat run on the same branch; `updating` until validated
- Implementation run: target `updating`, then both `synced`
- Artifact change sets `artifact_ahead`; summarization rewrites the card
- Validation merges implementation branches, keeping main's `knowledge-graph/`
- Invalid transaction raises a guard Harness/Issue
- Approving retention's Harness/Plan removes retired entities
