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

Real-life situations over the example projects, each in its own world.

| Kind | Runs | Usage |
|---|---|---|
| Real | Claude Code on the account | Its token share of its run's 5-hour rise |
| Scripted | Answered by the scripted model | None |
| No runs | Never answered | None |

- features.ts lists every feature; a coverage test fails while one has no scenario
- Hard limits; a dead back-end or a stall fails at once
- A used-up limit skips real scenarios; Continue runs the rest later
- Scripted: harness flows; product lives (releases, bugs, sprints, triage); entity links and folds, graph answers
- Patterns are proposed in the feed, counted once approved; optimization acts on three repeats
