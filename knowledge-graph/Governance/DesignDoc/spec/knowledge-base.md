---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 4
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/consistency-check
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Knowledge base

Graph RAG over typed entities, one per workspace.

- Entity is the unit and its card; a summary is an entity with artifacts, by summarization
- Origins: user, requested, automation; all reach the main line via the feed
- Card: no fixed structure, a user-set character limit sized for mobile; overflow splits into linked entities
- A type is a path: one directory per type; chats and actions are entities too
- Runs write freely on their branches; the gate is the main line
- Consistency guard: validates each transaction (card limit, references), raises issues, keeps sync state, updates the index
- Index and metrics database per workspace: indices, four metric families, usage, attention ranking
