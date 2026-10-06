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

Real-life situations over the four example projects, each in its own world.

| Kind | Runs | Usage |
|---|---|---|
| Real | Claude Code on the account | Its share of the 5-hour rise |
| Scripted | The scripted model | None |
| No runs | Never answered | None |

- features.ts lists every feature; a coverage test fails while one has no scenario
- A stall or a dead back-end fails at once; a used-up limit skips real scenarios
- Scripted: harness flows; product lives; links and answers; working alongside the user; the kb tools; card and risk rules; stream holes; notes-api, TypeScript with dependencies and a history
- Patterns: proposed in the feed, counted once approved
