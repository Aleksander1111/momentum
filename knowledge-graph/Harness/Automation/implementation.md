---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/implementation/agents/momentum-implementation.md
  - automations/implementation/risk.md
---
# Implementation

A regular Claude Code session that implements an approved entity on its own branch.

- Reads the target and everything it references: plans, criteria, decisions, constraints
- Follows the repository's conventions and runs its checks; never pushes, merges or touches the main line
- Writes no summary: the harness summarizes the changed files into the result entity
- Cannot implement as written: raises a Harness/Issue that `concerns` the target
- Risk (high, medium, low; medium by default) is the highest level any rule gives: data, security, contracts, concurrency, infrastructure, cross-service work, plans over 8 steps or unknowns are high
- Merged only after validation passes
