---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/summarization/agents/momentum-summarization.md
---
# Summarization

Summarizes repository artifacts: chats, plans, implemented results, documents the graph build lists.

- A sub-agent of every run, handed its artifacts by a Stop hook; a run of its own when an artifact changes
- The only writer of summaries; never commits or switches branches
- One entity per summary, artifacts listed; its card a paragraph, bullets, table or PlantUML diagram
- Rewrites the entity over a changed artifact only when its card turns wrong or incomplete; a spent entity gets a retirement plan
- Links entities a card names where it helps, each also among its references
- A chat becomes its Harness/Chat record only, titled by what it did: nothing is learnt from one chat
- Skips the paths the user excludes
