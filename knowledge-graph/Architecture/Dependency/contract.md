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

Internal library `@momentum/contract`: zod schemas and types shared by app, backend, entity, kb and runs, plus the generated `openapi.json` (16 paths).

| Area | Schemas |
|---|---|
| Entities | states, frontmatter, trigger fields, card blocks, list, detail, type tree, search |
| Feed | items, counts by state, approve, send back |
| Runs and chats | automation, trigger, status, usage %, messages |
| Graph build | building, stopped, complete; coverage, estimate, reset |
| Metrics | attention, understanding, per-automation runs, failures, time, usage |
| Settings | projects, cards, summarization excludes, lifetimes, concurrency, models |
| Session | password login, token, workspaces |
