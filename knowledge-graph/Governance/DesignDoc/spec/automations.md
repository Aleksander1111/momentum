---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
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
---
# Spec: automations

Defined by responsibility alone; definitions and triggers are entities.

| Automation | Does |
|---|---|
| Exploration | next best action within goals |
| Preparation | plans under `plans/` |
| Consistency check | raises issues as entities |
| Retention | retires spent entities by type rules |
| Implementation | works on own branch |
| Validation | gates merges; regression runs |
| Optimization | fixes recurring chat issues |
| Summarization | Stop-hook sub-agent |
| Chat | user-started run |
| Graph build | builds graph on enable |
