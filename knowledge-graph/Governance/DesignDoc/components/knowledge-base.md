---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 5
references:
  - to: Governance/DesignDoc/spec/components
    relation: part_of
  - to: Governance/DesignDoc/components/consistency-guard
    relation: depends_on
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - docs/SPEC.md
  - docs/entity-types.tsv
---
# Knowledge base

Graph RAG over the entity types in docs/entity-types.tsv.

- The entity is the unit; a summary is an entity with artifacts, written by summarization
- Origins: user, requested, automation; the user's own entity lands verified, an automation's unverified, through the feed
- Every entity is its card: a user-set character limit sized for mobile, free form; too big means split
- A type is a path on disk; chats and actions are entities too
- Runs write freely in their own checkout; everything lands on the main line when the run ends; approval is a state, not a place
- A plan is ordinary: approved, it stands entity_ahead until implemented
- No ingestion component
