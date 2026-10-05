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

- Grouped by workspace, led by its logo, polled every 15 s; rows show kind, status, age, states
- The composer starts a chat run; card parts in the context wait as chips above it
- A mic beside send: the words show as heard; its outcome opens the chat
- A conversation: run head (automation, state, 5-hour usage), bubbles polled every 3 s while active; Stop kills it
- Entities an answer names, by link or path, show their type's glyph and colour and open on a press
- An interview shows the document it writes and takes answers without context
- Web (700 px+) shows it beside the list
