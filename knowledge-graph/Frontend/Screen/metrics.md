---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references:
  - to: Harness/Automation/optimization
    relation: reports_on
  - to: Harness/Automation/consistency-check
    relation: reports_on
artifacts:
  - apps/app/src/app/(tabs)/metrics.tsx
---
# Metrics

Metrics tab per workspace (picker, "last N days"); stats show value and sparkline.

| Panel | Shows |
|---|---|
| Usage | Rolling 5 h and week %, meters split by automation, legend |
| Attention | Time per item; approved, rejected, sent back; patterns automated |
| Understanding | Consistency; open issues |
| Agents | Misalignments; recurring issues; runs this week |
| Implementation | Outstanding issues; bugs; defects |
| Automations | Last 7 days per automation (and variant): runs, failed, avg time, 5 h and week usage % |

Wide layout pairs the middle panels two per row.
