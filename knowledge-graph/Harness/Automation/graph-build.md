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
- Every run lands on the main line and reports its progress to the next; the harness measures completeness on the main line and tells each run what is missing
- Completeness: the mean of the questions a reader needs answered (product, purpose, capabilities, architecture, repository, environment, tests, rules) and the areas of the repository entities account for; a directory listed as an artifact claims all in it, and file, class or function cards count for nothing
- Ends when a run reports that nothing missing can be filled from the repository, or when the user stops it
