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

Scripts: `pnpm dev` (watch mode), `pnpm backend`, `pnpm test` (vitest), `pnpm momentum` (CLI), `pnpm e2e` (Playwright scenarios, apps/backend/e2e).
