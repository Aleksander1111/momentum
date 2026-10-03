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

`@momentum/contract`: zod schemas, types for backend and app.

| Area | Schemas |
|---|---|
| Entity | frontmatter, states, impacts, references, issues |
| Card | markdown blocks, PlantUML SVG, pickable parts |
| Card diff | ins/del marks, line spans, prior diagram, word counts |
| Feed | items, diffs, issue options, counts, reactions |
| Runs, chats | automations, status, usage %; context (quote, element, card); interview |
| Voice | target screen, status, partial text, outcomes |
| Graph build | state, coverage, estimate |
| Metrics | series, usage, states, histograms |
| Settings | projects, logo (image data URL ≤ 256 KB), cards, exclusions, lifetimes, models |

`openapi.json`: generated.
