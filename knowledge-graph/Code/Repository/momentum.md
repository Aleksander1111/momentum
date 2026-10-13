---
type: Code/Repository
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Workflow/web-export-from-main
    relation: consists_of
artifacts:
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - scripts/dev.mjs
  - README.md
  - .gitignore
---
# Momentum repository

pnpm 10 monorepo of the harness: TypeScript, Node 24

| Path | Holds |
|---|---|
| apps/backend | API, orchestrator, guard |
| apps/app | Expo app, web and mobile |
| packages/ | contract, entity, kb, runs |
| docs/ | Deck, entity-types.tsv |
| video/ | Harness video (Remotion) |
| automations/ | Automation definitions |
| knowledge-graph/ | This knowledge base |
| examples/ | Projects the e2e scenarios run over |

Scripts: `pnpm dev` (back-end on watch, web app [built from main](Architecture/Workflow/web-export-from-main)), `backend`, `test` (vitest), `typecheck`, `momentum` (CLI), `e2e [args]` (test runner only), `e2e:runner` (port 7400), `deck` (slides), `video` (voice, score, render).
