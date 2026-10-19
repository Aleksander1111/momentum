---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 1
references:
  - to: Harness/Automation/graph-build
    relation: controls
  - to: Harness/Automation/summarization
    relation: configures
  - to: Harness/Automation/implementation
    relation: configures
  - to: Code/ConfigSetting/entity-types
    relation: opens
artifacts:
  - apps/app/src/app/(tabs)/settings.tsx
---
# Settings

Saves when editing ends; projects reload on open.

| Section | Controls |
|---|---|
| Appearance | System, light, dark |
| Included projects | Switch enables; chevron opens logo, build rows |
| Graph build | State, mode, runs, entities, usage; completeness, estimate; Stop/Resume; In full/Pace; Reset |
| Feed size | Items before loops pause |
| Cards | Limit, presentation rules |
| Summarization | Excluded paths |
| Lifetimes | Rule per entity type |
| Agents | Concurrent runs in total |
| Models | One, per automation, or by risk |
| In the knowledge graph | Automations, [entity types](Code/ConfigSetting/entity-types), risk rules; triggers |
| This device | Sign out; clears its cache |
