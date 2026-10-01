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

In-process MCP server the runner gives every run, beside momentum-kb. Each tool records a report on the active run; the runner acts on it when the run ends.

| Tool | Input | When the run ends |
|---|---|---|
| `report_validation` | passed, form (review, test suite run, exploratory pass, consistency check), summary | Pass merges the branch into the main line (keeping knowledge-graph); fail or merge conflict holds the implementation run |
| `report_mapping` | complete, progress, coverage 0–1 | Stores progress and coverage (1 if complete); a finished complete run marks the mapping complete |
