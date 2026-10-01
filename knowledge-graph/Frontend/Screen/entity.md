---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references: []
artifacts:
  - apps/app/src/app/(tabs)/explorer/entity.tsx
  - apps/app/src/ui/EntityView.tsx
  - docs/designs/entity-web.png
  - docs/designs/entity-mobile.png
kind: page
---
# Entity screen

One entity in full, opened from the Explorer: breadcrumb of its path, verification and sync badges with labels, the card, references in both directions (each opening its entity) and the artifacts behind it with their kind.

- Web (700px and wider) shows it in a pane beside the Explorer tree; mobile opens it as its own page with a Back link to the Explorer
- Follows the light or dark colour scheme from the theme context
- Reads `GET /workspaces/{ws}/entities/{path}`
