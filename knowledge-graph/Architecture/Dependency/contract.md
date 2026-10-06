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

`@momentum/contract`: zod schemas, types for back-end, app; jitless in browsers, as the CSP forbids eval.

| Area | Schemas |
|---|---|
| Entity | frontmatter, states, references, issues; links |
| Card | blocks, PlantUML SVG, pickable parts |
| Card diff | marks, spans, prior diagram, word counts |
| Feed | items, versions, diffs, options, counts; reactions |
| Search | results; ask, sources |
| Runs, chats | automations, status, usage; context; interview |
| Timeline | actor, kind, facts, query, page |
| Voice | screen, status, partial text |
| Graph build, metrics | coverage; series |
| Settings | projects, logo, cards, lifetimes, models |

`openapi.json`: generated OpenAPI 3.0.
