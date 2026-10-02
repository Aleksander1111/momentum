---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 5
references:
  - to: Governance/DesignDoc/spec/orchestrator
    relation: consists_of
  - to: Governance/DesignDoc/spec/knowledge-base
    relation: consists_of
  - to: Governance/DesignDoc/spec/automations
    relation: consists_of
  - to: Governance/DesignDoc/spec/attention-feed
    relation: consists_of
  - to: Governance/DesignDoc/spec/database
    relation: consists_of
artifacts:
  - docs/SPEC.md
---
# Momentum harness spec

The harness is the single entry point between the user and the work around each project; it earns its place only by boosting performance, not costing attention.

- Workspace = git repo on the dedicated machine with its own knowledge base and goals; 5–20 enabled, isolated, single user
- Layers: attention (feed, approval), understanding (entities, index), implementation (automations, runs, validation)
- Nothing lands unattended: the guard validates, the user approves on the main line
- AI only for judgement; queries and rules for the rest
- Self-hosted, no cloud, reached over a private mesh

Open: adding workspaces, ranking tuning, source sync, scale targets.
