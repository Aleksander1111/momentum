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
  - automations/retention/agents/momentum-retention.md
---
# Retention

Proposes retiring entities from the main line once their lifetime is spent.

- Lifetime follows rules per entity type, given in the run context
- An entity something still references is not spent
- Each group of spent entities gets one Harness/Plan titled as a retirement: why each is spent, a `retires` reference to each, their files deleted on the branch
- Approving the plan removes them from the main line
- Never retires goals, automations or triggers
- Retirement plans carry low product and timeline impact
