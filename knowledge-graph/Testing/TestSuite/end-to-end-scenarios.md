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

Real-life situations over the four example projects, each isolated.

| Kind | Runs | Account |
|---|---|---|
| Real | Claude Code on the account | Its share of the 5-hour rise |
| Scripted | The scripted model | Unreached: own config, sign-in only, no outside host |
| No runs | Never answered | None |

- features.ts lists every feature; coverage fails while one has no scenario
- A stall or dead back-end fails at once; a spent limit skips real ones
- Scripted: flows, product lives, user alongside, kb tools, rules, stream holes, notes-api, API, swipes, appearance, limits, one line, harness tuning, skipped summarization
- Patterns: proposed in the feed, counted once approved
