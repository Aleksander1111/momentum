---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Models

Which Claude model a run starts on, set in Settings for all projects as model aliases (Default leaves it to Claude Code).

| Mode | Model |
|---|---|
| One for all | Same model for every run |
| Per automation | One per automation, summarization included |
| By risk | Implementation runs use the model set for their risk (low, medium, high); other automations keep their own |

- Risk estimated just before the run by a Haiku call applying `automations/implementation/risk.md` to the target entity and its plans
- No rules or no target: the automation's own model
- Model and risk recorded on the run, kept when its session resumes
