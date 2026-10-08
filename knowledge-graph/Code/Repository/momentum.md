---
type: Code/Repository
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references: []
artifacts:
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - scripts/dev.mjs
---
# Momentum repository

pnpm 10 monorepo of the harness: TypeScript, Node 24.

| Path | Holds |
|---|---|
| apps/backend | API, orchestrator, guard |
| apps/app | Expo app, web and mobile |
| packages/ | contract, entity, kb, runs |
| docs/ | Deck (@momentum/docs), entity-types.tsv |
| video/ | Harness video (@momentum/video, Remotion) |
| automations/ | Automation definitions |
| knowledge-graph/ | This knowledge base |
| examples/ | Projects the e2e scenarios run over |

Scripts: `pnpm dev`, `backend`, `test` (vitest), `typecheck`, `momentum` (CLI), `e2e [args]` (via the test runner only), `e2e:runner` (127.0.0.1:7400), `deck` (builds the slides), `video` (records the voice, synthesises the score, renders).
