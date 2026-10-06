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
artifacts: []
---
# Consistency guard

Reacts to every knowledge-base change, not only the scheduled check.

- Groups the changes of one run into a transaction, validates it and lands it on the main line as one commit
- Checks types and the references between entities
- What cannot be made consistent lands all the same, with an issue entity over it
- A change conflicting with the main line meanwhile lands on the run's side, raised as a conflict entity
- Updates the index and metrics database in every validated transaction
- Keeps each entity's sync: `updating` when a run targets it, `artifact_ahead` when its artifact changes, `entity_ahead` when approved without implementation, `synced` once they agree
