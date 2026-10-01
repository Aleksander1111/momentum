---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - docs/SPEC.md
---
# Spec: front-end and back-end

Attention layer shared; understanding and implementation once per project.

- **Front-end**: one web and mobile app: feed, chat tool, browsable and searchable entities
- **API**: front-end polls for feed items and run results; no push
- **Orchestrator**: ships with the API; runs loops from enabled projects' triggers, paused while the feed is full
- **Runs**: one Claude Code process each, own checkout and branch; isolated, live usage, killable from chat, output still passes the guard; concurrency bounded by API limits
- **Mapping**: starts on enable; stopped by the user or by disabling
- **Reset**: ends runs, drops branches, removes the graph in one commit, rebuilds; not the harness workspace
