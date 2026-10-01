---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec/consistency-guard
    relation: includes
  - to: Governance/DesignDoc/spec/index-and-metrics-database
    relation: includes
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Knowledge base

Graph RAG over many entity types, one per workspace.

- The entity is the unit: standalone, typed, with an origin (user, requested, automation); a summary is an entity with artifacts, written by summarization
- Every entity is its card: no fixed structure, only a user-set character limit sized for mobile; what does not fit is split into entities that reference each other
- A type is a path: entities of one type share a directory
- Chats and actions (failures, conflicts, resolutions) are entities
- Free reads and writes on run branches; the gate is the main line: guard-validated, user-approved
- No ingestion component: automations read sources, summarization turns artifacts into summaries
