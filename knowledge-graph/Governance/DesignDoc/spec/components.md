---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Spec: front-end and back-end

- One app for web and mobile: attention feed, chat tool, entity browsing and search
- API: front-end polls for feed items and run results; no push channel
- Orchestrator ships with the API; runs each enabled project's loops from its triggers, paused while the feed is full
- Enabling a project starts the graph build; reset ends runs, drops branches and the graph, rebuilds (harness workspace excluded)
- One Claude Code process per run, own checkout and branch; isolated, killable from chat, usage shown live
- Killed runs' writes still pass the guard to the feed
- Concurrency configurable, bounded by API limits
