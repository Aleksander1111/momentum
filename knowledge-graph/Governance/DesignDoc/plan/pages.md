---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 2
references: []
artifacts:
  - docs/PLAN.md
  - docs/designs/pages.html
---
# Plan: pages

| Page | Purpose |
|---|---|
| Session | Password sign-in |
| Feed | Ranked cards across projects, state counters; swipe right approves, left sends back with a comment |
| Entity | States, type path, card, references, artifacts |
| Explorer | Type-path tree, search, or explore through an agent |
| Chat | Chats per workspace; steer, ask, see usage or stop a run |
| Metrics | Four metric families; 5-hour and weekly usage % |
| Settings | Projects and graph build (stop, resume, reset), feed, cards, unsummarized paths, lifetimes, agents, models |

Five tabs on mobile, left rail on web, no page titles. System, light or dark theme per device. Also served: `/workspaces`, `/mcp`, `/openapi.json`.
