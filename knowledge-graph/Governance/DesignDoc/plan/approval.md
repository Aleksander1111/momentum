---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Plan: approval and send back

- Two states: `verification` (user) and `sync` (entity against artifact)
- Approve commits the entity verified to the main line, with what it retires and implements
- Approved implementable entity without `implements` becomes `entity_ahead`
- Send back starts a chat run on the same branch; `sync` is `updating`
- Artifact change sets `artifact_ahead`; summarization rewrites the card
- Validation merges implementation branches, keeping main's `knowledge-graph/`
- Invalid transaction raises a guard Harness/Issue
