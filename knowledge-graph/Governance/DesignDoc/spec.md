---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Architecture/System/momentum-harness
    relation: documents
  - to: Product/Product/momentum
    relation: documents
  - to: Architecture/Component/attention-feed
    relation: documents
  - to: Architecture/Component/knowledge-base
    relation: documents
artifacts:
  - docs/SPEC.md
kind: design doc
---
# Momentum harness spec

Founding design document: dictionary, components, database, deployment, open questions.

Settles:
- Layers: attention (feed, approval), understanding (entities, index), implementation (automations, runs, validation)
- Approved state is the system; every change passes the user's eyes in one feed ranked by product impact, timeline impact and unlocks
- Entity is the unit; a summary adds artifacts; cards fit a mobile screen
- Automations defined by responsibility, set up as entities; AI only where rules cannot decide
- Self-hosted on one machine behind a private mesh; no stack fixed

Open: workspace add/retire, validation forms, ranking tuning, source sync, Claude Code surface, scale, offline.
