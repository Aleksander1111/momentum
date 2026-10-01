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

Keeps the knowledge base consistent at all times despite free access, reacting to every change, not only the scheduled consistency check.

- Groups related changes into a transaction, validated before it lands on the main line
- Validates the card character limit and the references between entities
- Raises changes that cannot be made consistent as issues, like the consistency check
- Updates the index and metrics database in every validated transaction
- Maintains sync: `updating` while a run targets the entity, `artifact_ahead` when its artifact changes, `entity_ahead` when approved without an implementation, `synced` once they agree
