---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/implementation/agents/momentum-implementation.md
  - automations/implementation/risk.md
---
# Implementation

A regular Claude Code automation that implements approved entities.

- Works in its own checkout of the main line; the work lands on the main line when the run ends
- Its result is what summarization writes over the changed files, each entity referencing the target with `implements`; the target itself is never rewritten
- Validation runs over the landed work and raises what fails as issues
