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

Vitest, `pnpm test` at the root, 60 s a test. No server, runs or model: end-to-end scenarios cover those.

| Where | Covers |
|---|---|
| apps/backend/test | Approval rules over a real repository and index; password, sessions, refusals; completeness; models by risk; model protocol; command stream; serial calls; timeline; usage readings; run histograms; tool names, retrieval rating |
| packages/entity/test | Card length, parsing, validation, card diffs |
| packages/kb/test | Migrations and the index, on a test database |
| packages/runs/test | One line in one working directory; landing on the user's commits; reactions merged into a run's files; paths put back; run environment; rate limits |
