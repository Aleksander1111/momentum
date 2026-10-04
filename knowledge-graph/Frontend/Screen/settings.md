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
artifacts:
  - apps/app/src/app/(tabs)/settings.tsx
---
# Settings

Changes save when editing ends; projects reload whenever the tab opens.

| Section | Controls |
|---|---|
| Appearance | System, light or dark; this device |
| Projects | Logo and switch each; if enabled, upload/replace/remove the logo (PNG, JPEG, WebP, SVG ≤ 256 KB) |
| Graph build (enabled project) | State, runs, entities, time, 5 h/week usage; coverage, estimate; Stop/Resume; Reset on a second tap |
| Feed size | Items before loops pause |
| Cards | Character limit, presentation rules |
| Summarization | Never-summarized paths |
| Lifetimes | Rule per entity type |
| Agents | Concurrent runs in total |
| Models | One for all, per automation, or implementation by risk |
