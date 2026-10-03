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
| Entity | frontmatter, states, impacts, references, issue fields |
| Card | markdown blocks; PlantUML SVG with pickable elements |
| Card diff | ins/del marks; line spans for code and diagram source; before diagram; word counts |
| Feed | items with card diff and issue options; state counts; reactions |
| Runs, chats | automations, triggers, status, usage %; messages with context items (quote or diagram element) |
| Graph build | state, coverage, estimate |
| Metrics | series, usage, states, histograms |
| Settings | projects, cards, exclusions, lifetimes, models |

`openapi.json` is generated.
