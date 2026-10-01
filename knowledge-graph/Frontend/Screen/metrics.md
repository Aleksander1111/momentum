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
  - apps/app/src/ui/Sparkline.tsx
  - docs/designs/metrics-mobile.png
  - docs/designs/metrics-web.png
kind: page
---
# Metrics screen

One workspace's metrics over the last 30 days: a 2×2 grid of panels on wide screens, a stack on phones, in the light or dark appearance set in Settings.

| Panel | Stats |
|---|---|
| Usage | rolling 5 hours and week as percentages, never money |
| Attention | time per item, approved, rejected, sent back, patterns automated |
| Understanding | consistency, open issues |
| Agents | misalignments, recurring issues, runs this week, variant per automation |
| Implementation | outstanding issues, bugs, defects |

- Each stat: a sparkline of its daily series and its value, green or red for good or bad trends
- Workspace picker and a "last N days" badge
- Reads `GET /workspaces/{ws}/metrics`
