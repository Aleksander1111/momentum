---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/exploration
    relation: concerns
  - to: Harness/Automation/preparation
    relation: concerns
  - to: Harness/Automation/consistency-check
    relation: concerns
  - to: Harness/Automation/retention
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/validation
    relation: concerns
  - to: Harness/Automation/optimization
    relation: concerns
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - docs/SPEC.md
  - docs/diagrams/06-automations.md
---
# Automations spec

Background work per project, each defined by responsibility alone. Definitions and triggers are entities edited through the feed. AI only where queries and rules can't carry a step.

| Automation | Role |
|---|---|
| Exploration | Next best action within goals |
| Preparation | Plans under `plans/` |
| Consistency check | Issues as entities |
| Retention | Retires spent entities by type |
| Implementation | Own branch, merged when valid |
| Validation | Gates merges; regression loop |
| Optimization | Proposes definition changes |
| Summarization | Stop-hook step, not a trigger |
| Chat | Started by the user |
| Graph build | Run after run until covered |

Diagram still shows a Card step.
