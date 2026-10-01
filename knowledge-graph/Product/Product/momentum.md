---
type: Product/Product
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 5
references: []
artifacts:
  - docs/SPEC.md
---
# Momentum

The harness that boosts the work around a project: the single entry point between the user and that work, for every workspace on the dedicated machine.

- Three ways in: the attention feed, a chat tool, direct exploration of the entities
- Automations run in the background per enabled project, bounded by the feed
- Nothing changes unattended: every change passes the feed as an entity before it counts
- Feed counters show entities by verification and sync state
- Enabling a project maps its repository, with time, usage and a full-build estimate; a reset starts it afresh
- Manages itself: this repository is one of its workspaces
- Single user, self-hosted; 5 to 20 enabled projects at once
