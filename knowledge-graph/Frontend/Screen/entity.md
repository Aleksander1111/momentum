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
kind: page
---
# Entity screen

One entity in full, opened from the Explorer: its card with verification, sync and contradiction badges, references in both directions (each opening its entity) and the artifacts behind it with their kind.

- A card changed since the user last verified it shows the diff against that version, as in the feed
- Selected text and diagram shapes can be added to the chat context
- A mic below: a spoken command changes the entity, a question asks about it; either opens its chat
- Web (700 px+) shows it beside the Explorer tree; mobile opens it as its own page
- Reads `GET /workspaces/{ws}/entities/{path}`, card diff included
