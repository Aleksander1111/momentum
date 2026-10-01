---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 2
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
  - docs/designs/pages.html
---
# Plan: pages

| Page | Purpose |
|---|---|
| Session | Per-user session |
| Feed | Ranked cards, state counters, swipe to approve or send back |
| Entity | One entity in full |
| Explorer | Browse, search or ask an agent by type path |
| Chat | Chats per workspace; steer or stop a run |
| Metrics | Four metric families, 5-hour and weekly usage % |
| Settings | Projects, graph build, feed, cards, unsummarized paths, lifetimes, agents, models |

Five tabs on mobile, a left rail on web, no page titles. System, light or dark theme kept on the device. Also served: `/workspaces`, `/mcp`, `/openapi.json`.
