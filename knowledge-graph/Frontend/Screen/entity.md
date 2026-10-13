---
type: Frontend/Screen
origin: requested
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references: []
artifacts:
  - apps/app/src/app/(tabs)/explorer/entity.tsx
  - apps/app/src/ui/EntityView.tsx
  - apps/app/src/ui/CardView.tsx
kind: page
---
# Entity screen

One entity in full: its card with verification, sync and contradiction badges, then references and artifacts, folded till opened.

- References both ways, each with its relation, opening its entity, unframed on phone; artifacts with their kind
- Linked entities show their type's glyph and colour and open on a press; other links go to the web
- Changed since verified: the diff, as in the feed; a wide table scrolls sideways
- Selected text and diagram shapes go into the chat context
- A mic: a spoken command changes the entity, a question asks about it, in its chat
- A link to a retired or resolved entity says so and points to the timeline
- Wide: beside the Explorer tree; else its own page
