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

Aligns the automations with the user, measured on the collected metrics.

- Analyzes the chats since its last run and the issues raised: misalignments and recurring issues
- Records their counts with `record_agent_metric`
- Resolves the most recurring: a skill, sub-agent, definition change, new tool or MCP server, or trigger change
- Proposes through the feed: definition entities and automations/<name>/ files in the harness workspace, trigger entities in any workspace
- Competing implementations get a `variant` so the metrics compare them
- Each card gives the evidence and the expected effect
