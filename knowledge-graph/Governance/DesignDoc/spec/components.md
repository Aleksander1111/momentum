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
# Components

Three layers: attention on top, understanding beneath, implementation at the base. Attention is shared; everything beneath exists once per project.

- **Front-end**: one app, web and mobile; feed, chat tool, entity browsing
- **API**: front-end entry point; polling, no push
- **Orchestrator**: loops of enabled projects, bounded by the feed; one process, checkout and branch per run
- **Knowledge base**: graph RAG of entities as cards; consistency guard validates changes before the main line; index and metrics database
- **Automations**: ten loops, each defined by its responsibility; AI only for judgement
- **Attention feed**: one feed across projects, ranked; nothing counts until approved
