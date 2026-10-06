---
type: Testing/Mock
origin: requested
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 3
references:
  - to: Testing/TestSuite/end-to-end-scenarios
    relation: part_of
artifacts:
  - apps/backend/e2e/support/scripted.ts
---
# Scripted model

A local stand-in for the Claude API: real Claude Code and harness, the model's moves scripted per scenario.

- A turn: prompt, message, resume or hook request (told by the harness's shared words), with tool results; replies since pick the next move
- Moves: write, run a command, report progress, start summarization, say text; faults: hang, gate, API error
- Unscripted: say "Done.", start the summarization sub-agent when handed artifacts, write the commit message asked for
- `limits`: 5-hour and weekly use in the API's rate-limit headers
- Live: real API answers and headers; only faults apply; answers tagged per scenario so usage is shared
- Scenarios check outcomes
