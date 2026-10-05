---
type: Frontend/UiComponent
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Frontend/Screen/entity
    relation: used_by
  - to: Frontend/Screen/chat
    relation: used_by
  - to: Frontend/Screen/explorer
    relation: used_by
artifacts:
  - apps/app/src/ui/EntityRef.tsx
---
# Entity reference

How the app shows an entity wherever it names one: the glyph of its main type, its title in that type's colour, opening on a press.

- A row: references, events, an issue's concerns, an answer's sources
- Grouped: by type, each group led by the type's pill, as an event's entities and an entity's references
- Inline: a link in a card's text or a chat answer, on a faint wash of the colour; a path in code reads the same
- Opens the entity beside the Explorer tree on a wide screen, as its own page otherwise; the Explorer opens it in place
