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
  - automations/search/agents/momentum-search.md
---
# Search

Answers what the user asks in the knowledge graph search, as a search page answers above its results.

- One pass per question: no run, no checkout, no tools; started by the search itself, never by a trigger
- The search first finds the entities, by full text and meaning, and follows their references
- Answers from those entities alone, leading with the answer; says so when they do not hold it
- Names every entity it draws from as a link to it, so the answer opens the graph
- Runs on the model set for it in the settings
