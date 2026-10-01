---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Code/Repository/momentum
    relation: part_of
artifacts:
  - packages/contract/src/index.ts
  - packages/contract/openapi.json
kind: internal library
---
# contract package

`@momentum/contract`, internal library: the zod schemas and types shared by the app and the back-end.

- Entity states (verification, sync, origin), frontmatter, references, trigger fields
- Card blocks as rendered from the markdown AST
- Feed, entity detail, types tree, search, runs, chats, metrics, mapping status, settings and every request body
- `openapi.json` generated from the same schemas by `pnpm momentum openapi`
