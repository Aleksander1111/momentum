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
- Reads every chat and issue, never one alone: counts the candidates the Harness/Chat records list by name, then corrections, problems, requests, preferences, with `record_agent_metric`
- Proposes nothing seen under three times, nor a pattern already proposed
- From three repeats: a Harness/Pattern with the evidence and a skill, memory, sub-agent, definition or trigger change based on it; a tool or MCP server only proposed in the card
- A changed definition gets a `variant`; changes are in effect as they land, awaiting review; an automatic reaction waits for approval
