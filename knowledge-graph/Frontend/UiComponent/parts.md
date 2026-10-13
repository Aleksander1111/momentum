---
type: Frontend/UiComponent
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Frontend/Screen/chat
    relation: used_by
  - to: Frontend/UiComponent/theme
    relation: uses
artifacts:
  - apps/app/src/ui/parts.tsx
---
# Shared parts

The building blocks the screens are made of.

- Section heading, optionally led by an icon such as a project logo
- List and Row: a bordered list of rows, a row pressable and marked selected
- Row text: a title over a muted sub-line, which can hold styled text such as a coloured run state; a path may break anywhere
- Count pill; primary and ghost buttons, small to fit a row
- Back: to the screen beneath, the tab it came from, or the tab's home
- Close on back: Android back closes an open picker or pane, only on the screen in front
- Picker: serif value with a chevron and a dropdown, opening up at the bottom
- Segmented: a row of choices, one on
