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
# Models runs start on

Set in Settings for all projects, as Claude model aliases (Default leaves it to Claude Code):

| Mode | Model of a run |
|---|---|
| Single | One model for every run |
| Per automation | One per automation, summarization included |
| By risk | Implementation runs: a Haiku call rates risk low/medium/high from the user's rules in `automations/implementation/risk.md`, the target entity and its plans; the run takes that risk's model. Other automations, or no rules or target, keep their own |

Model and risk are recorded on the run and kept when its session resumes.
