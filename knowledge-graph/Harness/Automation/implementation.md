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
  - automations/implementation/trigger.md
---
# Implementation

A regular Claude Code automation that implements approved entities.

- Works in the project's working directory on the main line; the work lands there when the run ends
- Installs the project's dependencies there when missing and runs the project's own checks
- Its result is what summarization writes over the changed files, each entity referencing the target with `implements`; the target itself is never rewritten
- Validation runs over the landed work and raises what fails as issues
