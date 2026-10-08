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

Summarizes repository artifacts: plans, implemented results, documents the graph build lists; searches chats for optimization candidates.

- A sub-agent of every run, handed its artifacts by a Stop hook; a run of its own when an artifact changes
- The only writer of summaries; never commits
- One entity per summary, artifacts listed; its card a paragraph, bullets, table or PlantUML diagram
- Rewrites an entity only when its card turns wrong or incomplete; deletes one left with no artifact, which the harness reports
- Links entities it names, each also a reference
- A chat is never summarized: a Harness/Chat is written only for its skill, sub-agent or memory candidates (memory only on a misalignment), each with its evidence; nothing is made from one chat
- Skips the paths the user excludes
