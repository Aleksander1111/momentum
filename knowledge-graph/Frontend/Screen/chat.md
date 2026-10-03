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
artifacts:
  - apps/app/src/app/(tabs)/chat/index.tsx
  - apps/app/src/app/(tabs)/chat/[runId].tsx
  - apps/app/src/app/(tabs)/chat/_layout.tsx
  - apps/app/src/ui/Composer.tsx
  - apps/app/src/ui/Conversation.tsx
  - docs/designs/chats-web.png
  - docs/designs/chats-mobile.png
  - docs/designs/chat-mobile.png
---
# Chat screen

Chats per workspace, each a conversation attached to a run.

- Chats grouped by workspace, polled every 15 s; rows show kind, status, age, state badges
- The composer under the list starts a chat run in the chosen workspace; "Explore through an agent" lands here, composer focused
- Card parts added to the context wait as chips above the composer (× removes one), go with the next message and clear; sent bubbles show them
- A conversation heads with automation, state, 5-hour usage % and branch, then user and markdown agent bubbles, polled every 3 s while active; Stop kills it, the composer steers it
- Web (700 px+) shows it beside the list; mobile opens a page with Back
