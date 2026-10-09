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
  - automations/validation/agents/momentum-validation.md
  - automations/validation/trigger.md
---
# Validation

Validates the product, not only the change.

- Each implementation once it has landed on the main line: review, test suite run, exploratory pass or consistency check, by the change's entity type
- Installs the project's dependencies in its fresh checkout before the checks
- A failure is a Harness/Issue (`source: validation`) concerning the implemented entity; a pass writes nothing
- In the background: regression and exploratory testing
- Each issue: severity (high for wrong behaviour or a regression), its card quoting what the tool said (error line and code, failing test and assertion), 2-4 options with one recommended
- Never fixes what it finds
