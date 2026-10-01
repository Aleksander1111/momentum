---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - packages/contract/src/index.ts
  - packages/contract/openapi.json
  - packages/contract/package.json
---
# Contract

Internal library `@momentum/contract`: the zod schemas and types shared by the app and backend, plus the generated `openapi.json`.

| Area | Schemas |
|---|---|
| Entity states | verification, sync, origin, impact, reference, frontmatter |
| Entities | card blocks, list item, detail, type tree, search |
| Feed | items, counts by state, approve, send back |
| Runs and chats | automation, trigger, status, usage %, messages |
| Mapping | building, stopped, complete |
| Metrics | per-automation runs, failures, time, usage share |
| Settings | lifetimes, projects, model choice (single, per automation, by risk) |
| Session | password login, token, workspaces |
