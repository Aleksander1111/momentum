---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references: []
artifacts:
  - apps/app/src/app/(tabs)/metrics.tsx
---
# Metrics

A workspace's metrics over 24h, 7d or 30d (default); workspace picker (shared with Chat, Explorer), range switch on top.

| Panel | Shows |
|---|---|
| Usage | 5h and weekly limits: %, meter by automation, line over range |
| Over time | Picked metrics, one chart, ≤2 units: entity states, usage, runs, attention, understanding, agents, implementation, retrieval, tool relevance vs best |
| Retrieval | Runs' RAG score, precision, coverage, parallel; RAG, turns per automation; per tool relevance /5, calls, bar vs best |
| Runs by parameter | Runs per automation binned by usage, duration or messages |
| Automations | Runs, failed, avg time, usage % |

Hover: bucket value, parts; unmeasured: —.
