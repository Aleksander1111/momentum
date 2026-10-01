---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 4
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Spec: knowledge base

- Graph RAG per workspace; the unit is the entity, its type a directory path
- Origins: user, requested, automation; all reach the main line through the feed
- Summary = entity with artifacts, written by summarization; chats and actions are entities too
- Card: written by whoever writes the entity; only a configured, mobile-sized character limit; what does not fit is split
- Free writes on run branches; the gate is the main line
- Consistency guard: validates transactions (card limit, references), updates the index and metrics, maintains sync state
- Metrics: attention, understanding, agents, implementation; usage as % of the 5-hour and weekly limits
