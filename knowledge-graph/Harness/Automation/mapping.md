---
type: Harness/Automation
origin: user
verification: verified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/mapping/agents/momentum-mapping.md
---
# Mapping

Builds the knowledge graph of a workspace from its repository.

- Starts when the project is enabled; no trigger entity
- One run at a time, each writing at most the room the feed has
- Every run continues on the workspace's mapping branch and reports its progress to the next
- Ends when a run reports the repository covered, or when the user stops it
