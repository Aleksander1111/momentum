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
  - to: Infrastructure/CiCdPipeline/github-actions
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

pnpm 10 monorepo of the harness: TypeScript, Node 24, Windows only

| Path | Holds |
|---|---|
| apps/backend | API, orchestrator, guard |
| apps/app | Expo app, web and mobile |
| packages/ | contract, entity, kb, runs |
| docs/ | Deck, entity-types.tsv |
| video/ | Harness video (Remotion) |
| automations/ | Definitions |
| knowledge-graph/ | This graph |
| examples/ | e2e example projects |
| .github/ | [Checks on Linux](Infrastructure/CiCdPipeline/github-actions) |

`pnpm dev` serves main: back-end restarted on commits to it, web app [built from main](Architecture/Workflow/web-export-from-main). Also `test`, `typecheck`, `momentum` (CLI), `e2e`, `e2e:runner` (7400), `deck`, `video`.
