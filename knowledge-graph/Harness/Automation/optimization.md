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
  - automations/optimization/trigger.md
---
# Optimization

Aligns the automations with the user, measured on the metrics; approves nothing itself.

- Runs in the harness alone, reading every enabled project, never writing in one
- Reads every chat and issue, never one alone: corrections, recurring problems, requests, preferences; counts them with `record_agent_metric`
- Proposes nothing seen under three times, nor a pattern already proposed
- From three repeats: a Harness/Pattern with the evidence and a skill, memory, sub-agent, definition or trigger change based on it; a tool or MCP server only proposed in the card
- A changed definition gets a `variant` and is in effect as it lands, awaiting review; a trigger, skill or reaction waits for approval
