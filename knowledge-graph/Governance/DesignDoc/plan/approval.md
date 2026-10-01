---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 3
references: []
artifacts:
  - docs/PLAN.md
---
# Approval and send back

- `verification` (user judgement) and `sync` (entity vs artifact): independent
- Approve: entity committed to main as verified, with its `retires` (removed), `implements` (`synced`) and `chats/`; implementable without `implements` → `entity_ahead`
- Send back: chat run on the same branch with the comment; `updating` till validated
- Implementation: target `updating`, then both `synced`
- Artifact change → `artifact_ahead`; summarization rewrites the card
- Validation merges implementation branches, keeping main's `knowledge-graph/`; conflicts raise a Harness/Conflict
- Invalid transaction → guard Harness/Issue, out of the feed
- Approving retention's Harness/Plan removes retired entities
