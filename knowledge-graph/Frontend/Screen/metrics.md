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

Tab charting a workspace's metrics over 24 h, 7 d or 30 d (default); on top a workspace picker (logos, shared with Chat and Explorer, long names shrink) and range switch, clear of the Settings icon.

| Panel | Shows |
|---|---|
| Usage | 5-hour and weekly limits: %, meter split by automation, line over range |
| Over time | Picked metrics on one chart, two units at most, kept on device; entities by verification or sync, usage, runs, attention, understanding, agents, implementation |
| Runs by parameter | Runs per automation binned by 5-hour or weekly usage, duration or messages |
| Automations | Runs, failed, avg time, 5 h and week % |

Hover shows a bucket's value and parts; unmeasured: —.
