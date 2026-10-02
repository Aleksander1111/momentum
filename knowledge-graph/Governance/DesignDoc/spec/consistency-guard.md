---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Harness/Automation/consistency-check
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Consistency guard

Keeps the knowledge base consistent despite free access, reacting to every change, not only the scheduled consistency check.

- Groups the changes of one run into a transaction, validates it and lands it on the main line as one commit
- Validates the card character limit and the references between entities
- Changes that cannot be made consistent land all the same, with an issue entity over them
- A change conflicting with the main line meanwhile lands on the run's side, raised as a conflict entity
- Updates the index and metrics database in every validated transaction
- Maintains sync: `updating`, `artifact_ahead`, `entity_ahead`, `synced`
