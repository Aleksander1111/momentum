---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/mapping
    relation: controls
artifacts:
  - apps/app/src/app/(tabs)/settings.tsx
  - docs/designs/settings-web.png
  - docs/designs/settings-mobile.png
kind: page
---
# Settings screen

The harness settings, read and written through `/settings`; numbers save when editing ends, rules expand into an editor beneath their row.

- Appearance: theme System, Light or Dark, kept on the device, not the server
- Included projects: an enable switch each; an enabled project shows its knowledge graph build (state, runs, entities, usage as % of the 5-hour and weekly limits) with Stop, Resume and Reset, which asks for a second tap, then wipes the project's entities and data and rebuilds
- Feed size: items before loops pause
- Cards: character limit and presentation rules
- Lifetimes: a rule per entity type
- Agents: concurrent runs per project and in total
