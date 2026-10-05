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

pnpm monorepo of the Momentum harness: TypeScript everywhere, Node 24.

| Path | Holds |
|---|---|
| apps/backend | Fastify API, orchestrator, consistency guard |
| apps/app | Expo app for web and mobile |
| packages/ | contract, entity, kb, runs |
| automations/ | Claude Code files of the automation definitions |
| knowledge-graph/ | This knowledge base |
| docs/ | Presentation, slides, entity-types.tsv |
| examples/ | todo-cli, bookshelf-api, handbook: projects the end-to-end scenarios run over |

Scripts: `pnpm dev` (watch mode), `pnpm backend`, `pnpm test` (vitest), `pnpm momentum` (CLI), `pnpm e2e [playwright arguments]` (asks the test runner to run Playwright scenarios, apps/backend/e2e, opening it when it is closed; the only way tests run), `pnpm e2e:runner` (starts the test runner in the background, if it is not running, and opens its page at http://127.0.0.1:7400).
