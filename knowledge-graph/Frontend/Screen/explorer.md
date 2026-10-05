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

Browse a workspace's entities by domain and type, search them, ask them, or hand the exploration to an agent.

- Workspace picker, entity total; a domain/type tree with counts; rows with domain, title and states
- Search, by words and meaning, replaces the tree with results
- A question, or Enter, is answered above them by [the search automation](Harness/Automation/search), linking what it drew from; a chat takes it further
- A mic: spoken words fill the search, a spoken question is asked
- "Explore through an agent" opens the Chat tab, composer focused
- A breadcrumb elsewhere opens the tree at one folder
- Wide: the entity beside the tree; narrow: pushed
