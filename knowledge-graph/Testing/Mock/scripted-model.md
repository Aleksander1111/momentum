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

A local stand-in for the Claude API: real Claude Code runs with the harness's hooks, MCP servers and landing, while each scenario scripts what the model does.

- A turn is the run's prompt, a user message, a restart's resume or a hook's request (summarize, fix for the guard, commit message); replies since pick the next move
- Moves: write a file or entity, run a command, report graph build or interview progress, record a metric, say text, hang, wait for a gate, fail with an API error
- Unscripted turns say "Done." and write the commit message asked for; the risk estimator answers by rule
- Requests wait until the scenario's scripts are in; every turn and run's instructions are logged
