---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 2
references:
  - to: Harness/Automation/validation
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server the runner gives every run next to `momentum-kb`. Its tools record a run's report; the harness acts on it when the run ends.

| Tool | Input | When the run ends |
|---|---|---|
| `report_validation` | passed, form (review, test suite run, exploratory pass, consistency check), summary | Pass merges the branch into the main line; fail holds it until the raised issue is resolved |
| `report_graph_build` | complete, progress, coverage 0–1, documents | Progress feeds the next run and estimates the full build; complete stops the build; documents go to summarization |
