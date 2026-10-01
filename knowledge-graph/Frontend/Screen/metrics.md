---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Architecture/Service/app
    relation: part_of
  - to: Data/Database/index-and-metrics-database
    relation: presents
artifacts:
  - apps/app/src/app/(tabs)/metrics.tsx
  - apps/app/src/ui/Sparkline.tsx
  - docs/designs/metrics-web.png
  - docs/designs/metrics-mobile.png
kind: page
---
# Metrics screen

The four metric families over time and usage, per workspace.

| Panel | Stats |
|---|---|
| Attention | time per item, approved, rejected, sent back, patterns automated |
| Understanding | consistency, open issues |
| Agents | misalignments, recurring issues, runs this week, variant per automation |
| Implementation | outstanding issues, bugs, defects |

- Each stat shows a sparkline of its series and its current value
- Usage tiles: rolling 5 hours and rolling week as percentages; never money
- Workspace picker shared with the Explorer, and a "last N days" badge
- Reads `GET /workspaces/{ws}/metrics`
