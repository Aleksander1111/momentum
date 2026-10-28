---
type: Frontend/Screen
origin: requested
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/chat
    relation: opens
  - to: Harness/Automation/interview
    relation: opens
  - to: Harness/Automation/search
    relation: asks
  - to: Architecture/Service/app
    relation: exported_by
artifacts:
  - apps/app/src/app/(tabs)/explorer/index.tsx
  - apps/app/src/app/(tabs)/explorer/entity.tsx
  - apps/app/src/app/(tabs)/explorer/_layout.tsx
  - apps/app/src/ui/Answer.tsx
kind: page
---
# Explorer screen

Browse a workspace's entities by domain and type, search or ask them, or hand over to an agent.

- Project picker, logos, entity total; domain/type tree with counts; rows: domain, title, states
- No project: says no graph, links to Settings
- Search by words and meaning replaces the tree; no match offers Enter to ask
- A question, or Enter, is answered by [search](Harness/Automation/search) with sources; unframed on phone
- Mic in the search: what is said is typed into it as heard; a question typed so asks
- "Explore through an agent" opens Chat, composer focused
- A link opens one folder; empty says so
- Wide: entity beside the tree; narrow: pushed; either way the feed's card, swipes and chat included
- [Exported](Architecture/Service/app) with a graph: search only; no ask, mic, agent
