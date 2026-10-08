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
  - to: Harness/Automation/optimization
    relation: serves
  - to: Data/Database/index-and-metrics-database
    relation: writes
artifacts:
  - apps/backend/src/activity.ts
  - apps/backend/src/retrieval.ts
---
# Turn activity and retrieval rater

- **Activity**: each run session is a turn; each tool call ("server · tool", detail, time, error, result start) and tokens recorded as they happen
- **Retrieval**: every call but writes, Task/Agent, record_agent_metric, momentum-run tools
- **Rating**: a chat turn that retrieved is pending; Haiku reads question, answer, ≤40 calls (1500 chars each), rates each 0–5, coverage 0–1
- Tool relevance: calls' mean, relative to the best; precision: share ≥3; score: mean of precision, coverage; parallel: two tools in one response
- Kept on the turn and as metrics
- **Overview**: a project's means over the last days (30) and each tool's, for [the optimization](Harness/Automation/optimization)
