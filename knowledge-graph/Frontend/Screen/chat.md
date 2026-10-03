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

Chats per workspace, each a conversation attached to a run.

- Chats grouped by workspace, led by its logo, polled every 15 s; rows show kind, status, age, state badges
- The composer starts a chat run in the chosen workspace
- Card parts in the context wait as chips above the composer (× removes one) and go with the next message
- A mic beside send: the field shows the words as heard; its outcome opens the chat; a failed item returns
- A conversation: run head (automation, state, 5-hour usage %), bubbles, polled every 3 s while active; Stop kills it
- An interview shows the document it writes, from the main line, and takes answers without context
- Web (700 px+) shows it beside the list
