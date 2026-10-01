---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Harness/Automation/validation
    relation: used_by
  - to: Harness/Automation/mapping
    relation: used_by
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server each run gets beside `momentum-kb`, for reporting back to the harness.

| Tool | Input | When the run ends |
|---|---|---|
| `report_validation` | `passed`, `form` (review, test suite run, exploratory pass, consistency check), `summary` | Passed: merged into the main line keeping its `knowledge-graph/`, implementation run finished. Failed: implementation run held. Merge conflict: `Harness/Conflict` raised, run held |
| `report_mapping` | `complete`, `progress` | Progress saved for the next run's prompt, even if the run failed; `complete` on a finished run ends a building mapping |
