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
artifacts:
  - docs/SPEC.md
---
# Spec: knowledge base

- Graph RAG; the unit is the entity, its type a directory path
- Origins: user, requested, automation; all reach the main line through the feed
- Summary = entity with artifacts, by summarization; chats and actions are entities too
- Card: written by the entity's writer; configured, mobile-sized limit; what does not fit is split
- Free writes on run branches; the gate is the main line
- Consistency guard: validates transactions (card limit, references), updates index and metrics, maintains sync state
- Per-workspace store: attention, understanding, agent and implementation metrics over time; usage as % of 5-hour and weekly limits, shared rises split among concurrent runs
