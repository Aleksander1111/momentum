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
    relation: serves
  - to: Harness/Automation/mapping
    relation: serves
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server the runner gives every run next to `momentum-kb`. Automations use it to report outcomes back to the harness. Each report is stored on the run and acted on when the run ends.

| Tool | Input | Effect at run end |
|---|---|---|
| `report_validation` | passed, form (review, test suite run, exploratory pass, consistency check), summary | Pass merges the branch into the main line. Fail or merge conflict holds the implementation run |
| `report_mapping` | complete, progress, coverage 0–1 | Saves progress and coverage (1 when complete). Complete on a finished run ends the build |
