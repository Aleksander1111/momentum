---
type: Testing/TestSuite
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 2
references:
  - to: Code/Repository/momentum
    relation: part_of
  - to: Testing/TestSuite/end-to-end-scenarios
    relation: complements
artifacts:
  - vitest.config.ts
  - apps/backend/test
  - packages/entity/test
  - packages/kb/test
  - packages/runs/test
---
# Unit tests

Vitest, `pnpm test` at the root, 60 s a test. No server, runs or model: those are the end-to-end scenarios' to cover.

| Where | Covers |
|---|---|
| apps/backend/test | Approval rules over a real repository and index; password, sessions, refused requests; completeness; models by risk; the model protocol both sides share; command stream; serial calls; timeline; usage readings; run histograms |
| packages/entity/test | Card length, parsing, validation and card diffs |
| packages/kb/test | Migrations and the index, on a test database |
| packages/runs/test | Paths put back before landing, the run environment, rate-limit events |
