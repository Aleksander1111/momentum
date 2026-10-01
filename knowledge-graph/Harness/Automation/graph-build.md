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
  - automations/graph-build/agents/momentum-graph-build.md
---
# Graph build

Builds the knowledge graph of a workspace from its repository.

- Starts when the project is enabled; no trigger entity
- One run at a time, each writing at most the room the feed has
- Every run lands on the main line and reports its progress to the next, with the share of the repository covered, which estimates the time and usage of the full build
- Ends when a run reports the repository covered, or when the user stops it
