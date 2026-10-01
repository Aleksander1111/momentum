---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/app
    relation: part_of
  - to: Harness/Automation/mapping
    relation: controls
artifacts:
  - apps/app/src/app/(tabs)/settings.tsx
  - docs/designs/settings-web.png
  - docs/designs/settings-mobile.png
kind: page
---
# Settings screen

The harness settings, read and written through `/settings`.

- Included projects: each with its enable switch; an enabled project shows its knowledge graph build (state, runs, entities, usage) with Stop and Resume
- Feed size: items before loops pause
- Cards: character limit and presentation rules
- Lifetimes: a rule per entity type
- Agents: concurrent runs per project and in total
- Numbers save when editing ends; rules expand into an editor beneath their row
