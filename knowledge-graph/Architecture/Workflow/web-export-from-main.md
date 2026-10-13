---
type: Architecture/Workflow
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Architecture/Service/app
    relation: concerns
  - to: Architecture/Service/backend
    relation: served_by
  - to: Code/Repository/momentum
    relation: part_of
artifacts:
  - scripts/export-web.mjs
---
# Web export from the main line

The served web app is built from the main line, never the working tree: uncommitted edits cannot mask what landed.

- `scripts/export-web.mjs`: `git archive` of `apps/app` and `packages/contract` at `main` (or `MOMENTUM_WEB_REF`), unpacked into the gitignored `.build/web`; `@momentum/contract` junctioned to the unpacked contract; `expo export --platform web` from there into `apps/app/dist` or `MOMENTUM_APP_DIST`
- `pnpm dev` ([dev.mjs](Code/Repository/momentum)) polls `git rev-parse main:apps/app main:packages/contract` every 2 s and exports [the app](Architecture/Service/app) again when they change
- [The back-end](Architecture/Service/backend) serves the new build without a restart
