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

Internal library `@momentum/contract`: zod schemas and types shared by the app, backend, entity, kb and runs packages, plus the generated `openapi.json`.

| Area | Schemas |
|---|---|
| Entities | states, frontmatter, card blocks, list, detail, type tree, search |
| Feed | items, counts by state, approve, send back |
| Runs and chats | automation, trigger, status, usage %, messages |
| Mapping | building, stopped, complete |
| Metrics | attention, understanding, per-automation runs, failures, time, usage |
| Settings | projects, cards, lifetimes, concurrency, models (single, per automation, by risk) |
| Session | password login, token, workspaces |
