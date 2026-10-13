---
type: Frontend/UiComponent
origin: requested
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

The screens' building blocks.

- Section heading, optionally led by an icon, e.g. a project logo
- useFrame: outlined panel on wide screens, none on phone
- List and Row: pressable rows, one selected; unframed on phone, rows aligned with headings; `float` keeps it for drop-downs
- Row text: title over a muted sub-line that can hold styled text (a coloured run state); paths break anywhere
- Count pill; primary, ghost buttons, small for rows
- Back: to the screen beneath, the tab it came from, or the tab's home
- Close on back: Android back closes an open picker or pane, front screen only
- Picker: serif value, chevron, dropdown opening up at the bottom
- Segmented: a row of choices, one on
