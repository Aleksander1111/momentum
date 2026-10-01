---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references: []
artifacts:
  - packages/contract/src/index.ts
  - packages/contract/openapi.json
kind: internal library
---
# contract package

`@momentum/contract`, internal library: the zod schemas and types shared by the app and the back-end.

- Entity states (verification, sync, origin), frontmatter, references, trigger fields
- Card blocks as rendered from the markdown AST
- Feed with counts of entities by verification and sync state
- Mapping status with time spent, coverage, full-build estimate and whether the project can be reset
- Entity detail, types tree, search, runs, chats, metrics, settings and every request body
- `openapi.json` generated from the same schemas by `pnpm momentum openapi`, including project reset
