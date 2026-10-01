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
  - to: Architecture/Component/knowledge-base
    relation: presents
artifacts:
  - apps/app/src/app/(tabs)/explorer/entity.tsx
  - apps/app/src/ui/EntityView.tsx
  - docs/designs/entity-web.png
  - docs/designs/entity-mobile.png
kind: page
---
# Entity screen

One entity in full, opened from the Explorer: verification and sync badges, the type path, the card, references in both directions (each opening its entity) and the artifacts behind it.

- Web shows it beside the Explorer tree; mobile opens it as its own page with a Back link
- Reads `GET /workspaces/{ws}/entities/{path}`
