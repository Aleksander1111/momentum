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
  - automations/exploration/agents/momentum-exploration.md
---
# Exploration

Decides the single next best action for the project, guided by the workspace's goals.

1. Reads the Product/Goal entities; follows goals, never sets or changes them
2. Goes idle, writing nothing, when every goal is met
3. Researches the decision: knowledge base first (search, references), then the repository directly
4. Picks the action that makes the product best while keeping the journey there optimal
5. Writes a Harness/Research entity and an action entity (DevTask, Feature, TechDebt, Bug…) that `advances` the goal and is `based_on` the research, with honest impact scores

Prefers queries (indices, references, metrics) over judgement, spending judgement only on the decision.
