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
artifacts:
  - docs/PLAN.md
---
# Models

Which Claude model each run starts on, set in Settings for all projects as model aliases (Default leaves it to Claude Code).

| Mode | Model of a run |
|---|---|
| Single | One model for every run |
| Per automation | One per automation, summarization included |
| By risk | Implementation runs use the model for their risk (low, medium, high); every other automation keeps its own |

Risk is estimated just before the run by a Haiku call applying the rules in `automations/implementation/risk.md` to the target entity and its plans; without rules or a target the run keeps its own model. Model and risk are recorded on the run and kept when its session resumes.
