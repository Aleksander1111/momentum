---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/exploration
    relation: specifies
  - to: Harness/Automation/preparation
    relation: specifies
  - to: Harness/Automation/consistency-check
    relation: specifies
  - to: Harness/Automation/retention
    relation: specifies
  - to: Harness/Automation/implementation
    relation: specifies
  - to: Harness/Automation/validation
    relation: specifies
  - to: Harness/Automation/optimization
    relation: specifies
  - to: Harness/Automation/summarization
    relation: specifies
  - to: Harness/Automation/chat
    relation: specifies
  - to: Harness/Automation/graph-build
    relation: specifies
artifacts:
  - docs/SPEC.md
---
# Automations spec

Background automations per project that prepare work ahead of the user.

- Defined by responsibility, not by entity type; each searches the whole knowledge base
- Configured as entities: a definition per automation in the harness workspace, a trigger entity per workspace; changed through the feed
- AI only for judgement (deciding, planning, reviewing, summarizing); indices, metrics, lifetimes and references are queries and rules
- Ten: exploration, preparation, consistency check, retention, implementation, validation, optimization, summarization, chat, graph build
- Summarization runs from a run's Stop hook, not a trigger; step automations have no trigger entity
