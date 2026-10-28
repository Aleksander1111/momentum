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
  - apps/app/src/ui/CardScreen.tsx
  - apps/app/src/ui/EntityParts.tsx
  - apps/app/src/ui/CardView.tsx
kind: page
---
# Entity screen

One entity in full, the feed's card in every part: card with verification, sync and contradiction badges; references and artifacts, folded till opened.

- Reacts as in the feed: right approves or resolves with the picked option, left asks rework or another resolution, pulled up opens its chat; reacted to, it leaves for where it was opened
- Back above the card, where the feed has its counters
- References both ways, each with its relation, opening its entity, unframed on phone; artifacts with their kind
- Linked entities show their type's glyph and colour, open on a press; other links go to the web
- Changed since verified: the diff, as in the feed; wide tables scroll sideways
- Selected text and diagram shapes go into the chat context
- A link to a retired or resolved entity says so, points to the timeline
- Wide: beside the Explorer tree; else own page
- Exported: still, no reactions or chat
