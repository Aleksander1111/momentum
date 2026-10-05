---
type: Testing/TestSuite
origin: requested
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 3
references:
  - to: Testing/Mock/scripted-model
    relation: depends_on
  - to: Code/Repository/momentum
    relation: part_of
artifacts:
  - apps/backend/e2e/scenarios.ts
  - apps/backend/e2e/features.ts
  - apps/backend/e2e/support/fixtures.ts
---
# End-to-end scenarios

Real-life situations over the example projects, each in its own world. One user, one straight line.

| Kind | Runs | Usage |
|---|---|---|
| Real | Claude Code on the account | Up to the 5-hour and weekly limits |
| Scripted | Claude Code answered by the scripted model | None |
| No runs | Requests never answered | None |

- features.ts lists every feature; a coverage test fails while one has no scenario
- Hard limits; a dead back-end or nothing moving fails at once
- A used-up limit skips real scenarios; Continue runs the rest later
- Scripted: harness flows and product lives: releases, bugs, refactors, sprints, triage, reviews
