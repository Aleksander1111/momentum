---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
kind: page
references:
  - to: Harness/Automation/mapping
    relation: controls
artifacts:
  - apps/app/src/app/(tabs)/settings.tsx
---
# Settings

Settings tab; changes save when editing ends.

| Section | Controls |
|---|---|
| Appearance | System, light or dark; stays on this device |
| Included projects | On/off switch per project |
| Knowledge graph (enabled project) | State, runs, entities, time and 5 h/week usage; coverage and full-build estimate; Stop/Resume; Reset with a second tap |
| Feed size | Items before loops pause |
| Cards | Character limit; presentation rules |
| Lifetimes | Rule per entity type |
| Agents | Concurrent runs per project and in total |
