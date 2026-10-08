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
  - to: Code/ConfigSetting/entity-types
    relation: configured_by
  - to: Harness/Automation/search
    relation: answered_by
artifacts:
  - docs/entity-types.tsv
---
# Knowledge base

Graph RAG over the [entity types](Code/ConfigSetting/entity-types), one knowledge base per workspace.

- Entities are markdown at `knowledge-graph/<Domain>/<Type>/[<parent>/]<name>.md`; the type is the path
- Frontmatter: type, origin, verification, sync, ranking, references, artifacts; the body is the card
- Summaries, plans, issues, patterns, triggers, definitions are entities; chats are not
- The guard lands each run as one commit; unverified entities enter the feed
- A card may link the entities it names; each link is also a reference
- Retrieval: full text and embeddings fused by rank, expanded along references; [the search automation](Harness/Automation/search) answers from it
