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
  - docs/entity-types.tsv
---
# Knowledge base

Graph RAG over the entity types in docs/entity-types.tsv.

- The entity is the unit; a summary is one with artifacts
- Origins: user, requested, automation; the user's lands verified, an automation's unverified
- Every entity is its card, free form within a user-set limit; too big means split
- A type is a path on disk; actions, patterns and chats with optimization candidates are entities
- A Harness/Pattern proposes a skill, memory, definition change or reaction after three sightings; a reaction takes effect only once approved
- Runs write in their own checkout, landing on the main line at run end
- An approved plan is entity_ahead until implemented; no ingestion component
