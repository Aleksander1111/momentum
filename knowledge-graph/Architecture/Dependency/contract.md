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

`@momentum/contract`: zod schemas and types for backend and app.

| Area | Schemas |
|---|---|
| Entity | frontmatter, states, impacts, references, issues |
| Card | markdown blocks; PlantUML SVG, pickable elements |
| Card diff | ins/del marks; line spans; before diagram; word counts |
| Feed | items with card diff, issue options; counts; reactions |
| Runs, chats | automations; status, usage %; context: quote, element or card; interview state |
| Voice | target screen; status, partial text, item outcomes |
| Graph build | state, coverage, estimate |
| Metrics | series, usage, states, histograms |
| Settings | projects, cards, exclusions, lifetimes, models |

`openapi.json` is generated.
