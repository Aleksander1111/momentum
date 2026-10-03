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

Summarizes repository artifacts: chats, plans, results implemented by AI, documents listed by the graph build.

- A sub-agent of every run: a Stop hook hands it the run's artifacts before the run ends; a run of its own when an artifact changes
- The only writer of summaries: runs never summarize their own artifacts
- Never commits, pushes or switches branches: the harness commits what it leaves in the checkout
- Each summary is an entity with its artifacts listed; the entity is its card: paragraph, bullets, table or PlantUML diagram (mermaid is not accepted)
- Skips the path patterns the user excludes
