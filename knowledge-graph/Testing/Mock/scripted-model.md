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
- Live: every answer is the real API's; only faults apply, triggered by what the run did; each answer passed on is tagged with its scenario, so the runner shares a run's usage among its scenarios
- Scenarios check outcomes, not wording: what landed, types, references, tests passing
