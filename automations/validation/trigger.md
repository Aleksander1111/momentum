---
type: Harness/Trigger
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 3
references: []
artifacts: []
automation: validation
schedule: "0 2 * * *"
events:
  - implementation_finished
on_demand: true
---
# Validation trigger

Starts when an implementation finishes on its branch, and runs regression and exploratory testing every night at 02:00.
