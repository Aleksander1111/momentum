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
kind: design doc
---
# Momentum harness spec

Founding design document: dictionary, components, database, deployment, open questions.

Settles:
- Layers: attention (feed, approval), understanding (entities, index), implementation (automations, runs, validation)
- Approved state is the system; one feed ranked by product impact, timeline impact and unlocks, counted by state
- Entity is the unit; a summary adds artifacts; cards fit a phone
- Automations defined by responsibility; AI only where rules cannot decide
- Enabling a project maps its repository; a reset rebuilds it
- Self-hosted on one machine behind a private mesh

Open: workspace add/retire, validation forms, ranking tuning, source sync, Claude Code surface, scale, offline.
