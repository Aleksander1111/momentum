---
type: Architecture/Api
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Architecture/Component/runner
    relation: exposed_by
  - to: Harness/Automation/validation
    relation: used_by
  - to: Harness/Automation/mapping
    relation: used_by
artifacts:
  - apps/backend/src/runner.ts
---
# momentum-run MCP server

In-process MCP server through which a run reports back to the harness, defined in `apps/backend/src/runner.ts`.

- `report_validation` (validation runs): passed or failed, the form taken and a summary; a passed branch is merged into the main line with `knowledge-graph/` kept as it is there, a failed or conflicting one holds the implementation run under the issue raised
- `report_mapping` (mapping runs): progress for the next run and whether the repository is covered; stored in the harness schema, carried into the next run's prompt, and the mapping ends once covered
