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

Changes save when editing ends; projects reload whenever the tab opens.

| Section | Controls |
|---|---|
| Appearance | System, light or dark |
| Projects | Switch and logo each |
| Graph build | State, runs, entities, time, usage, coverage; Stop/Resume; Reset |
| Feed size | Items before loops pause |
| Cards | Character limit, presentation rules |
| Summarization | Never-summarized paths |
| Lifetimes | Rule per entity type |
| Agents | Concurrent runs in total |
| Models | One, per automation, or by risk |
| In the knowledge graph | Automations, [entity types](Code/ConfigSetting/entity-types), risk rules; triggers and patterns per project |
| This device | Sign out; clears its cache |
