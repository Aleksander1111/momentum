---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/validation
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP

In-process MCP server given to every run beside momentum-kb; runs report outcomes the harness acts on when they end.

| Tool | Input | When the run ends |
|---|---|---|
| report_validation | passed, form, summary | Passed: branch merged, implementation finished. Failed or conflict: held |
| report_graph_build | complete, progress, coverage 0–1, documents? | Progress and coverage stored; complete stops the build. Documents go to summarization via the Stop hook |
