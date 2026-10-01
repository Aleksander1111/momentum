---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Approval and send back

- `verification` (the user's judgement) and `sync` (entity against its artifact) are independent
- Approve commits the entity to main as verified, with what it `retires` and `implements`; implementable entities without `implements` become `entity_ahead`
- Send back starts a chat run on the branch with the comment; `updating` until validated
- Implementation targets an `entity_ahead` entity; the approved result `implements` it and both become `synced`
- Artifact change sets `artifact_ahead`; summarization rewrites the card
- Validation merges implementation branches; conflicts raise a Harness/Conflict
- Invalid transactions get a guard Harness/Issue and stay out of the feed
