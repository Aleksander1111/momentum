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
  - to: Harness/Automation/interview
    relation: concerns
  - to: Harness/Automation/search
    relation: concerns
artifacts: []
---
# Spec: automations

Defined by responsibility; definitions and triggers are entities.

| Automation | Does |
|---|---|
| Exploration | next best action within goals |
| Preparation | plans in `plans/` |
| Consistency check | raises issues; counts contradictions |
| Retention | retires spent entities |
| Implementation | own checkout; lands on the main line |
| Validation | checks landed work; failures raise issues |
| Optimization | proposes fixes for what recurs in chats |
| Summarization | Stop-hook sub-agent; one run per main-line change |
| Chat | user-started, alongside the loops |
| Graph build | builds graph on enable |
| Interview | one document, question by question |
| Search | graph answers, no run |
