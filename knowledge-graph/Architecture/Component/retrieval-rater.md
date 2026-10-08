---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 3
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Harness/Automation/chat
    relation: concerns
  - to: Data/Database/index-and-metrics-database
    relation: writes
artifacts:
  - apps/backend/src/activity.ts
  - apps/backend/src/retrieval.ts
---
# Turn activity and retrieval rater

- **Activity**: each session of a run is a turn after the last user message; each tool call ("server · tool", one-line detail, time, error, result start) and the tokens recorded as they happen
- **Retrieval**: every call but writes, Task/Agent, record_agent_metric, momentum-run tools
- **Rating**: a chat's turn that retrieved is pending; Haiku reads question, answer, ≤40 calls (1500 chars each), rates each 0–5 and coverage 0–1
- Tool relevance: its calls' mean, relative to the best; precision: share ≥3; score: mean of precision and coverage; parallel: two tools in one response
- Kept on the turn and as rag and retrieval metrics
