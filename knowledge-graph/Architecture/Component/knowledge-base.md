---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 3
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Data/Database/index-and-metrics-database
    relation: indexed_in
  - to: Architecture/Dependency/entity
    relation: depends_on
  - to: Architecture/Dependency/kb
    relation: depends_on
artifacts:
  - docs/entity-types.tsv
---
# Knowledge base

Graph RAG over 152 entity types (`docs/entity-types.tsv`), one knowledge base per workspace.

- Entities are markdown files at `knowledge-graph/<Domain>/<Type>/[<parent>/]<name>.md`; the type is the path
- Frontmatter: type, origin, verification, sync, the three ranking integers, references, artifacts; the body is the card
- A summary is an entity with artifacts; chats, plans, issues, triggers and automation definitions are entities too
- Runs write freely in a detached checkout; the guard lands each as one commit on the main line, conflicts as a Conflict entity; unverified entities enter the feed
- Retrieval: full text and embeddings fused by reciprocal rank, then expanded along references
