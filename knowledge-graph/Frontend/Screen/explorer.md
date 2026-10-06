---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/chat
    relation: opens
  - to: Harness/Automation/interview
    relation: opens
  - to: Harness/Automation/search
    relation: asks
artifacts:
  - apps/app/src/app/(tabs)/explorer/index.tsx
  - apps/app/src/app/(tabs)/explorer/entity.tsx
  - apps/app/src/app/(tabs)/explorer/_layout.tsx
  - apps/app/src/ui/Answer.tsx
kind: page
---
# Explorer screen

Browse a workspace's entities by domain and type, search or ask them, or hand the exploration to an agent.

- Workspace picker (shared with Chat and Metrics), entity total; a domain/type tree with counts; rows: domain, title, states
- A workspace not included says nothing maps it, links to Settings
- Search, by words and meaning, replaces the tree; no match offers Enter to ask
- A question, or Enter, is answered by [the search automation](Harness/Automation/search), linking its sources
- A mic: spoken words search, a question is asked
- "Explore through an agent" opens Chat, composer focused
- A breadcrumb opens the tree at one folder
- Wide: the entity beside the tree; narrow: pushed
