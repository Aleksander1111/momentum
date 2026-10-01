---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 5
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
artifacts:
  - docs/SPEC.md
---
# Spec: knowledge base

Graph RAG per workspace; the entity is the unit and is its card.

- Types are paths; a summary is an entity with artifacts
- Origins: user, requested, automation; all reach the main line via the feed
- Card: no fixed structure, a user-set character limit sized for mobile; split entities that do not fit
- Chats and actions (failures, conflicts) are entities too
- Free writes on branches; the consistency guard validates transactions (card limit, references), raises issues, updates the index
- Guard keeps sync: `updating`, `artifact_ahead`, `entity_ahead`, `synced`
- No ingestion: summarization turns artifacts into summaries, from each run's Stop hook and in one run per main-line change
