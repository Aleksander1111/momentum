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
| apps/app | Expo app for web and mobile |
| packages/ | contract, entity, kb, runs |
| docs/ | Deck package (@momentum/docs), entity-types.tsv |
| automations/ | Automation definitions |
| knowledge-graph/ | This knowledge base |
| examples/ | Projects the e2e scenarios run over |

Scripts: `pnpm dev`, `pnpm backend`, `pnpm test` (vitest), `pnpm typecheck`, `pnpm momentum` (CLI), `pnpm e2e [args]` (scenarios, only through the test runner), `pnpm e2e:runner` (runner page at 127.0.0.1:7400), `pnpm deck` (builds the presentation).
