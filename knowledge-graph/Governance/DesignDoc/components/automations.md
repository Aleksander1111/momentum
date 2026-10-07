---
type: Governance/DesignDoc
origin: automation
verification: verified
sync: synced
product_impact: 5
timeline_impact: 4
unlocks: 5
references:
  - to: Governance/DesignDoc/spec/components
    relation: part_of
  - to: Governance/DesignDoc/components/knowledge-base
    relation: concerns
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
# Automations

Background loops per project, preparing work ahead of the user.

- Defined by responsibility, not entity type; each searches the whole knowledge base
- Configured as entities: a definition in the harness workspace (Claude Code files as artifacts) and a trigger per workspace for nine; summarization (a step), graph build (on enable) and search (no run) have none; optimization's trigger is in the harness only
- AI only for deciding, planning, reviewing, summarizing; queries and rules carry the rest
- Twelve: exploration, preparation, consistency check, retention, implementation, validation, optimization, summarization, chat, graph build, interview, search
