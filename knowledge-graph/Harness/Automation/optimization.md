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
  - automations/optimization/agents/momentum-optimization.md
---
# Optimization

Aligns the automations with the user; nothing changes until the user approves it.

- Runs in the harness alone, reading every enabled project, never writing in one
- Reads every chat and issue, never one chat alone: corrections, recurring problems, requests, preferences
- Records their counts with `record_agent_metric`
- Proposes nothing seen fewer than three times, nor a pattern already proposed
- From three repeats: a Harness/Pattern with the evidence, and a skill, memory, sub-agent, definition, tool or trigger change based on it
- Every changed definition gets a `variant` so the metrics compare it
- All of it waits in the feed for approval
