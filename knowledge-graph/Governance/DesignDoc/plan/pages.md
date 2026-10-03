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
artifacts: []
---
# Plan: pages

| Page | Purpose |
|---|---|
| Session | Per-user session |
| Feed | Ranked cards, state counters; swipe right approves, left disapproves with a comment |
| Entity | States, type path, card, references, artifacts |
| Explorer | Type-path tree, search, or explore through an agent |
| Chat | Chats per workspace; steer, ask, see usage, stop a run |
| Metrics | Four metric families; 5-hour and weekly usage % |
| Settings | Projects and graph build, feed, cards, unsummarized paths, lifetimes, agents, models |

Five tabs on mobile, left rail on web, no page titles. System, light or dark theme per device. Also served: `/workspaces`, `/mcp`, `/openapi.json`.
