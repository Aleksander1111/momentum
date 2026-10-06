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
artifacts: []
---
# API

- Entry point between the front-end and the agents
- Ships in the same back-end deployable as the orchestrator
- The front-end polls for new feed items and long-running run results; no push channel for them, as changes are infrequent enough for polling; voice alone uses WebSockets
- Every capability but reading a repository file, changing a logo and signing out is reachable through the user's voice tools, so the system can be driven without the UI
