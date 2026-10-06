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

`@momentum/contract`: zod schemas, types for backend, app; jitless in browsers (CSP forbids eval).

| Area | Schemas |
|---|---|
| Entity | frontmatter, states, references, issues; links |
| Card | blocks, PlantUML SVG, pickable parts |
| Card diff | marks, spans, prior diagram, counts |
| Feed | items, versions, diffs, issue options, concern titles, counts; reactions |
| Search | results; ask, sources |
| Runs, chats | automations, status, usage, context, interview |
| Timeline | actor, kind, facts (removed too), page |
| Voice | screen, status, partials |
| Build, metrics | coverage; series |
| Settings | projects, logo, cards, lifetimes, models |

`openapi.json`: generated OpenAPI 3.0.
