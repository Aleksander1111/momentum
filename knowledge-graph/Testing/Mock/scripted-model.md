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

- A turn: prompt, message, resume or hook request, with tool results; replies since pick the next move
- Moves: say text; write a file or an entity; remove a file; run a command; report build progress or an interview step; record an agent metric; start summarization
- Faults: hang, API error; a gate holds an answer until the scenario opens it
- Unscripted: say "Done.", start the summarization sub-agent when handed artifacts, write the commit message asked for
- `limits`: 5-hour and weekly use in rate-limit headers
- Live: real API answers; only faults apply
