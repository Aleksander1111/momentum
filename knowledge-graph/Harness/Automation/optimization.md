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
- Reads every chat transcript and issue, never one alone: searches the generations for skill and sub-agent candidates, and memory candidates where an agent was misaligned; counts misalignments and recurring issues with `record_agent_metric`
- Reads each project's retrieval ratings (`retrieval_ratings`): weak tools and missed coverage are candidates too
- Each reasonable candidate is a Harness/Pattern from its first sighting: kind, `seen`, the chats with quotes, what it would hold
- From three sightings: the skill, memory, sub-agent, definition or trigger change itself, based on the pattern; a tool or MCP server only proposed in the card
- A changed definition gets a `variant`; changes are in effect as they land, awaiting review; an automatic reaction waits for approval
