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

- Runs in the harness workspace alone, over every enabled project, which it reads but never writes
- Analyzes each project's chats since its last run and the issues raised: misalignments and recurring issues
- Records their counts across projects with `record_agent_metric`
- Resolves the most recurring: skill, sub-agent, definition, tool, MCP server or trigger change
- Proposes through the feed: definition entities and automations/<name>/ files, trigger changes in its trigger.md
- Every changed definition, and every competing implementation, gets a `variant` so the metrics compare them
- Each card gives the evidence, by project, and the expected effect
