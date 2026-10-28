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

- **Activity**: each session a turn; each tool call ("server · tool", detail, time, error, result start), tokens recorded live
- **Retrieval**: every call but writes, Task/Agent, record_agent_metric, report_graph_build, report_interview
- **Rating**: any run's turn that retrieved, at run end; Haiku reads question or automation prompt, answer (4000 chars), ≤40 calls (1500), each 0–5, coverage 0–1
- Tool relevance: calls' mean, relative to best; precision: share ≥3; score: mean of both; parallel: two tools in one response
- Kept on the turn, as metrics
- **Overview**: a project's means over the last days (30), per automation and per tool, for [the optimization](Harness/Automation/optimization)
