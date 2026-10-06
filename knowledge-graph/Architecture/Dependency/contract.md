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

`@momentum/contract`: zod schemas and types for backend and app, jitless (CSP).

| Area | Schemas |
|---|---|
| Entity | frontmatter, states, references, issues, links |
| Card | blocks, PlantUML SVG, pickable parts |
| Card diff | marks, spans, prior diagram, counts |
| Feed | items, versions, diffs, issue options, titles, counts; reactions |
| Search | results; ask, sources |
| Runs, chats | automations, status, usage, context, interview |
| Timeline | actor, kind, facts, page |
| Voice | screen, status, partials |
| Build, metrics | completeness (slots, areas, detail), estimate; series |
| Settings | projects, logo, cards, lifetimes, models |

`openapi.json`: generated OpenAPI 3.0
