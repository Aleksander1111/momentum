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
  - to: Harness/Automation/optimization
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process, beside `momentum-kb`.

**report_graph_build** (every run)

| Input | Effect |
|---|---|
| complete | Ends the build once nothing missing can be filled |
| progress | Carried to the next run's prompt |
| documents | Handed to summarization |

Not reporting fails the run; 3 in a row stop the build.

**report_interview** (interview, every turn)

| Input | Effect |
|---|---|
| question | Next question, or closing remark |
| done | Unlocks summary, commit message |
| document | File outside knowledge-graph/; summarized when done |

**retrieval_ratings** ([optimization](Harness/Automation/optimization)): per enabled project turns' means and each tool's relevance over `days` (1–90, 30)
