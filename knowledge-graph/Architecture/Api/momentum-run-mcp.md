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
  - to: Harness/Automation/mapping
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server the harness gives every run next to `momentum-kb`. Its tools only record a report; the harness acts on it when the run ends.

| Tool | Input | When the run ends |
|---|---|---|
| `report_validation` | passed, form (review, test suite run, exploratory pass, consistency check), summary | Pass merges the branch into the main line; fail or merge conflict holds the implementation |
| `report_mapping` | complete, progress, coverage 0–1, documents? | Stores progress and coverage; complete ends the build; documents are queued for summarization |
