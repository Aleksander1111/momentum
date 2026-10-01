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

Internal library `@momentum/contract`: the zod schemas and types shared by the backend and the app, the API's one source.

| Area | Schemas |
|---|---|
| Entity | frontmatter, verification, sync, origin, 0–5 impacts, references |
| Card | markdown AST blocks, mermaid as SVG |
| Feed | items, counts by state, approve, send back |
| Runs, chats | automations, triggers, status, usage in % |
| Graph build | state, coverage, estimate |
| Metrics | 24h/7d/30d series, usage per automation, entities per state, run histograms |
| Settings | projects, cards, exclusions, lifetimes, concurrency, models |

`openapi.json` (OpenAPI 3.0.3) is generated from them by the backend's `openapi` command.
