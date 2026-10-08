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

- A turn: prompt, message, resume or hook request, with tool results; replies pick the next move
- Moves: say text; parallel tool calls; write a file or entity; remove a file; run a command; report build or interview; record a metric; start summarization
- Faults: hang, API error; a gate holds an answer until opened
- Unscripted: say "Done.", summarize handed artifacts, write the commit message; rate retrieval (call 1: 5, rest 3, coverage 1)
- `limits`: 5-hour and weekly use in rate-limit headers
- Live: real API answers; only faults apply
