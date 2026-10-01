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

Page tab charting a workspace's metrics over 24 h, 7 d or 30 d (hourly or daily buckets); workspace picker and range switch on top.

| Panel | Shows |
|---|---|
| Usage | Rolling 5-hour and week limits: %, meter split by automation, line over range |
| Attention | Time per item, approved, rejected, sent back, patterns automated |
| Understanding | Consistency (0–1), open issues |
| Agents | Misalignments, recurring issues, runs |
| Implementation | Outstanding issues, bugs, defects |
| Automations | Table of runs, failed, avg time, 5 h and week % per automation; stacked charts of each |

Hovering a bucket shows its value; two columns when wide.
