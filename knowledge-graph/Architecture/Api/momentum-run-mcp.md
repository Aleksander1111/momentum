---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 2
references:
  - to: Harness/Automation/interview
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server every run gets beside `momentum-kb`.

**report_graph_build** (every run)

| Input | Effect |
|---|---|
| complete | Ends the build, on the timeline; only once nothing the harness measures missing can be filled (each run is told what) |
| progress | The next run's prompt carries it |
| documents | Handed by the Stop hook to summarization |

A run that never reports fails; 3 in a row stop the build.

**report_interview** (interview runs, every turn)

| Input | Effect |
|---|---|
| question | Next question, or closing remark |
| done | Unlocks summary and commit message |
| document | Relative file outside knowledge-graph/, else refused; summarized when done |
