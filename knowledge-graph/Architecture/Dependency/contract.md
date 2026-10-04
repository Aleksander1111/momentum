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
| Card diff | marks, line spans, prior diagram, word counts |
| Feed | items with version, diffs, issue options, counts; reactions with version seen |
| Runs, chats | automations, status, usage %; context; interview |
| Timeline | actor, kind, facts, query, page |
| Voice | screen, status, partial text, outcomes |
| Graph build, metrics | state, coverage; series, usage, histograms |
| Settings | projects, logo ≤ 256 KB, cards, lifetimes, models |

`openapi.json`: generated.
