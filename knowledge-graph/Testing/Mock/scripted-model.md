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

- A turn: the prompt, a message, a resume or a hook's request, with the tool results so far; replies since pick the next move
- Moves: write, run a command, report progress, say text; faults: hang, gate, API error
- Unscripted turns say "Done." and write the commit message asked for
- `limits`: the 5-hour and weekly use every answer reports in the API's rate-limit headers
- Live: answers and headers are the real API's; only faults apply; each answer is tagged with its scenario so the runner shares usage among scenarios
- Scenarios check outcomes, not wording
