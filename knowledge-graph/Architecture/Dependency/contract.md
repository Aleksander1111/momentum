---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 4
references: []
artifacts:
  - packages/contract/package.json
  - packages/contract/tsconfig.json
  - packages/contract/src/index.ts
  - packages/contract/openapi.json
kind: internal library
---
# Contract

`@momentum/contract`: zod schemas and types shared by backend and app.

| Area | Schemas |
|---|---|
| Entity | frontmatter, states, 0–5 impacts, references; trigger and issue fields (severity, options, recommended, wont_resolve) |
| Card | markdown AST blocks, mermaid as SVG |
| Feed | items with issue options and concerns, state counts; approve, send back, resolve, won't resolve |
| Runs, chats | automations, triggers, status, usage in % |
| Graph build | state, coverage, estimate |
| Metrics | series by range, usage, entities per state, histograms |
| Settings | projects, cards, exclusions, lifetimes, models |

`openapi.json` is generated from them.
