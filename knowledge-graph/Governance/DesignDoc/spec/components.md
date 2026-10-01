---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - docs/SPEC.md
---
# Spec: front-end and back-end

- One app for web and mobile: attention feed, chat tool, entity browsing and search
- API: the front-end polls for feed items and run results; no push channel
- Orchestrator ships with the API; starts loops from each enabled project's triggers and pauses them while the feed is full
- One Claude Code process per run, in its own checkout and branch; isolated, killable, usage shown live
- Enabling a project starts the graph build; reset wipes its entities, branches and database rows and rebuilds (not the harness workspace)
- Concurrency configurable, bounded by API limits
