---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references:
  - to: Harness/Automation/mapping
    relation: controls
  - to: Harness/Automation/summarization
    relation: configures
  - to: Harness/Automation/implementation
    relation: configures
artifacts:
  - apps/app/src/app/(tabs)/settings.tsx
---
# Settings

Settings tab; each change saves when editing ends.

| Section | Controls |
|---|---|
| Appearance | System, light or dark; this device only |
| Included projects | Switch per project |
| Knowledge graph (enabled project) | State, runs, entities, time, 5 h/week usage; coverage, full-build estimate; Stop/Resume; Reset with a second tap |
| Feed size | Items before loops pause |
| Cards | Character limit; presentation rules |
| Summarization | Never-summarized path patterns, one per line |
| Lifetimes | Rule per entity type |
| Agents | Concurrent runs per project and in total |
| Models | One for all, per automation, or implementation by risk (low/medium/high via harness risk rules) |
