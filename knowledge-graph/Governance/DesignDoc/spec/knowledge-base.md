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
artifacts: []
---
# Spec: knowledge base

Graph RAG per workspace; the entity is the unit and is its card.

- Types are paths; a summary is an entity with artifacts
- Origins: user, requested, automation; the user's land verified, an automation's unverified
- Card: no fixed structure, a user-set character limit sized for mobile; split entities that do not fit
- Chats and actions (failures, conflicts) are entities too
- Runs write freely in their own checkout; everything lands on the main line when the run ends; approval is a state, not a place; a plan is ordinary
- The guard validates transactions (card limit, references), raises issues, keeps sync
- No ingestion: summarization turns artifacts into summaries
