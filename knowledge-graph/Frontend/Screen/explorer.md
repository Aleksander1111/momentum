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

- Workspace picker with the entity total; a collapsible tree of types with counts, entities with verification and sync badges
- Search, debounced 300 ms, replaces the tree with a flat result list
- "Explore through an agent" opens the Chat tab with the workspace chosen and the composer focused
- Wide layouts show the selected entity beside the tree, keyed by URL params; narrow ones push the entity screen with a back link
- Every route subscribes to the theme, so a light/dark switch in Settings applies instantly
