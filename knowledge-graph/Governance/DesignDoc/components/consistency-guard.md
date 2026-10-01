---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 4
references:
  - to: Governance/DesignDoc/components/knowledge-base
    relation: part_of
  - to: Governance/DesignDoc/components/index-and-metrics-database
    relation: concerns
  - to: Harness/Automation/consistency-check
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Consistency guard

Reacts to every knowledge-base change, not only the scheduled check.

- Groups related changes into a transaction and validates it before the main line
- Checks the card limit and references between entities
- Raises what cannot be made consistent as issues
- Updates the index and metrics database in every validated transaction
- Keeps each entity's sync state: `updating` when a run targets it, `artifact_ahead` when its artifact changes, `entity_ahead` when approved without implementation, `synced` once they agree
