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

- Workspace picker with the entity total; a collapsible tree of domains and types with counts; entity rows show a domain badge, the title and the verification, sync and contradiction badges
- Search, debounced 300 ms, replaces the tree with a flat result list
- "Explore through an agent" opens the Chat tab with the workspace chosen and the composer focused
- A breadcrumb elsewhere opens a workspace with the tree unfolded to one folder
- Wide layouts show the selected entity beside the tree, keyed by URL params; narrow ones push the entity screen
- A light/dark switch applies instantly
