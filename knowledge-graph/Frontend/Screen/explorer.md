---
type: Frontend/Screen
origin: automation
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
artifacts:
  - apps/app/src/app/(tabs)/explorer/index.tsx
  - apps/app/src/app/(tabs)/explorer/entity.tsx
  - apps/app/src/app/(tabs)/explorer/_layout.tsx
  - docs/designs/explorer-web.png
  - docs/designs/explorer-mobile.png
kind: page
---
# Explorer screen

Browse a workspace's entities by domain and type, search them, or hand the exploration to an agent.

- Workspace picker with the entity total; a collapsible domain/type tree with counts; entity rows with domain, title and state badges
- Search, debounced 300 ms, replaces the tree with a flat result list
- A mic in the search field: spoken words fill the search; an interview started by voice opens its chat
- "Explore through an agent" opens the Chat tab with the workspace chosen and the composer focused
- A breadcrumb elsewhere opens a workspace with the tree unfolded to one folder
- Wide layouts show the selected entity beside the tree; narrow ones push the entity screen
