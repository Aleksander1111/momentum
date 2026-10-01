---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Governance/DesignDoc/spec/components
    relation: part_of
  - to: Governance/DesignDoc/components/orchestrator
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# API

- Entry point between the front-end and the agents
- Ships in the same back-end deployable as the orchestrator
- The front-end polls for new feed items and long-running run results; no push channel, as changes are infrequent enough for polling
