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

A workspace's metrics over 24 h, 7 d or 30 d (default); a workspace picker (logos, shared with Chat and Explorer) and range switch on top.

| Panel | Shows |
|---|---|
| Usage | 5-hour and weekly limits: %, meter split by automation, line over range |
| Over time | Picked metrics on one chart, two units at most: entity states, usage, runs, attention, understanding, agents, implementation, retrieval |
| Retrieval | RAG score, precision, coverage, in parallel; per tool relevance /5, calls, bar vs the best |
| Runs by parameter | Runs per automation binned by usage, duration or messages |
| Automations | Runs, failed, avg time, usage % |

Hover shows a bucket's value and parts; unmeasured: —.
