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
---
# Momentum repository

pnpm monorepo of the harness: TypeScript, Node 24.

| Path | Holds |
|---|---|
| apps/backend | API, orchestrator, guard |
| apps/app | Expo app for web and mobile |
| packages/ | contract, entity, kb, runs |
| automations/ | Automation definition files |
| knowledge-graph/ | This knowledge base |
| docs/ | Presentation, slides, entity-types.tsv |
| examples/ | Projects the end-to-end scenarios run over |

Scripts: `pnpm dev` (watch), `pnpm backend`, `pnpm test` (vitest), `pnpm momentum` (CLI), `pnpm e2e [args]` (the only way scenarios run, through the test runner), `pnpm e2e:runner` (the runner's page at http://127.0.0.1:7400).
