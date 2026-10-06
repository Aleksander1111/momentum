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

- The entity is the unit; a summary is one with artifacts, by summarization
- Origins: user, requested, automation; the user's lands verified, an automation's unverified
- Every entity is its card: a user-set limit sized for mobile, free form; too big means split
- A type is a path on disk; chats, actions, patterns are entities too
- A Harness/Pattern proposes a skill, memory, definition change or reaction after three sightings: in effect as it lands, a reaction only once approved
- Runs write in their own checkout and land on the main line at run end
- An approved plan is entity_ahead until implemented; no ingestion component
