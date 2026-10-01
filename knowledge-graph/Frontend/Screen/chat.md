---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/app
    relation: part_of
  - to: Harness/Automation/chat
    relation: starts
artifacts:
  - apps/app/src/app/(tabs)/chat/index.tsx
  - apps/app/src/app/(tabs)/chat/[runId].tsx
  - apps/app/src/ui/Conversation.tsx
  - apps/app/src/ui/Composer.tsx
  - docs/designs/chats-web.png
  - docs/designs/chat-mobile.png
kind: page
---
# Chat screen

Chats per workspace, each a conversation attached to a run.

- Lists chats grouped by workspace, polled every 15 s; each row shows kind, status, age and state badges
- A conversation heads with the run's automation, state, 5-hour usage and branch, then its messages, polled every 3 s while it runs; Stop kills it, the composer steers it
- The composer under the list starts a new chat run in the chosen workspace; "Explore through an agent" lands here with it focused
- Web shows the conversation beside the list; mobile opens it as its own page
