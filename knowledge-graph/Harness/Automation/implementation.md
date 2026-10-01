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

Implements an approved entity on its own branch.

- Reads the target and everything it references; follows repo conventions and checks
- Never pushes, merges or touches main; the harness commits
- Writes no summary: the Stop hook hands changed files to summarization
- Cannot implement as written → Harness/Issue that `concerns` the target
- Merged only after validation passes

Risk (highest rule wins, default medium): **high** for data, security, contracts, concurrency, infrastructure, cross-service work, plans over 8 steps or open questions; **medium** for in-package features and fixes; **low** for copy, styling, config, tests-only or 1–3 step plans.
