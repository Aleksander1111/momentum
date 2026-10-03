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

In-process MCP server the runner gives every run next to `momentum-kb`; the harness acts on its reports.

**report_graph_build** (every run)

| Input | Effect |
|---|---|
| complete | Marks a building graph build complete once the run finished; coverage 1; on the timeline |
| progress | The next run's prompt carries it |
| coverage 0–1 | Estimates the full build |
| documents | Handed by the Stop hook to summarization |

**report_interview** (interview runs, every turn)

| Input | Effect |
|---|---|
| question | Next question, or closing remark |
| done | Unlocks the summary and commit message |
| document | File outside knowledge-graph/; summarized when done |
