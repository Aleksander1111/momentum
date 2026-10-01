---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/app
    relation: part_of
  - to: Architecture/Component/knowledge-base
    relation: browses
  - to: Frontend/Screen/entity
    relation: opens
artifacts:
  - apps/app/src/app/(tabs)/explorer/index.tsx
  - docs/designs/explorer-web.png
  - docs/designs/explorer-mobile.png
kind: page
---
# Explorer screen

Browse a workspace's entities by type path, search them, or explore through an agent.

- Workspace picker; a tree of domains and types with counts, entities with their state badges
- Debounced search over `GET /workspaces/{ws}/search`
- "Explore through an agent" opens the Chat tab with the workspace chosen and the composer focused
- Web shows the entity beside the tree; mobile opens the entity screen
