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

Vitest, `pnpm test` at the root, 60 s a test. No server, runs or model: end-to-end covers those. Run on Linux by CI on every push and pull request.

| Where | Covers |
|---|---|
| apps/backend/test | Approval rules over a real repo and index; password, sessions, refusals; completeness; attached files in the prompt, safe names; models by risk; model protocol; command stream; serial calls; timeline; usage; histograms; retrieval rating; the shipped automation definitions: directories, entities, agent files, default triggers |
| packages/entity/test | Card length, parsing, validation, diffs |
| packages/kb/test | Migrations and the index, on a test database |
| packages/runs/test | One line, one working dir; lands on user commits, only its changes, user's uncommitted kept; reactions merged; paths put back; run env; rate limits |
