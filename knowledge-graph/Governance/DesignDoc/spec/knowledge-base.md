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
- Origins: user, requested, automation; every entity lands with the verification its frontmatter says, unverified by default
- Card: no fixed structure; runs are told a user-set character limit sized for mobile, and split entities that do not fit
- Chats and actions (failures, conflicts) are entities too
- Runs write freely in their own checkout; everything lands on the main line when the run ends; approval is a state, not a place
- The guard validates transactions, raises issues, keeps sync
- No ingestion: summarization turns artifacts into summaries
