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

Summarizes repository artifacts: plans, implemented results, documents the graph build lists. Never chat transcripts.

- A sub-agent of every run, handed its artifacts by a Stop hook; a run of its own when an artifact changes
- The only writer of summaries; never commits
- One entity per summary, artifacts listed; its card a paragraph, bullets, table or PlantUML diagram
- Rewrites an entity only when its card turns wrong or incomplete; deletes one left with no artifact, which the harness reports
- Links entities it names, each also a reference
- Skips the paths the user excludes
