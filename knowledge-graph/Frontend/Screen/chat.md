---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references:
  - to: Harness/Automation/chat
    relation: starts
  - to: Harness/Automation/interview
    relation: shows
artifacts:
  - apps/app/src/app/(tabs)/chat/index.tsx
  - apps/app/src/app/(tabs)/chat/[runId].tsx
  - apps/app/src/app/(tabs)/chat/_layout.tsx
  - apps/app/src/ui/Composer.tsx
  - apps/app/src/ui/Conversation.tsx
---
# Chat screen

Chats per workspace, each a conversation on a run.

- Grouped by workspace under its logo, polled every 15 s; rows: title, kind, status, age
- With more than one project, a picker shared with Explorer and Metrics picks a new chat's project
- Composer: Enter sends, Shift+Enter breaks a line, on a phone the button sends; context waits as chips above; an unsent message says why and stays
- A mic by send shows words as heard
- Run head: automation, state, 5-hour usage, the entity the chat is about; Stop shows Stopping until it ends
- Bubbles polled every 3 s while active; tables and code full width; named entities open on a press
- Wide: beside the list, Android back closes it; narrow: a page
