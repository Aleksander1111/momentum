---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
  - to: Harness/Automation/implementation
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Plan: models

Set in Settings for all projects, as Claude model aliases (Default leaves it to Claude Code).

| Mode | Model a run starts on |
|---|---|
| One for all | The same model for every run |
| Per automation | Its automation's model, summarization and card steps included |
| By risk | Implementation runs: the model for their risk; others keep their own |

Risk (low, medium, high) is estimated just before an implementation run by a Haiku call applying the user's rules in `automations/implementation/risk.md` to the target entity and its plans. With no rules or target, the run keeps its automation's model. Model and risk are recorded on the run and kept on resume.
