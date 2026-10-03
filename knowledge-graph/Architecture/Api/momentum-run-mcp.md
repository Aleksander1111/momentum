---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 2
references:
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server the runner gives every run next to `momentum-kb`. Its one tool, `report_graph_build`, records a graph build run's report; the harness acts on it when the run ends.

| Input | Effect |
|---|---|
| complete | Marks a building graph build complete once the run finished; coverage counts as 1 |
| progress | Stored; the next run's prompt carries it |
| coverage 0–1 | Stored; estimates the full build |
| documents | Handed by the Stop hook to summarization with the changed artifacts |
