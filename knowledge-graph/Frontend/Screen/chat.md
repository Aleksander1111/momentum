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

- Lists chats grouped by workspace, polled every 15 s; rows show kind, status, age and state badges
- The composer under the list starts a chat run in the chosen workspace; "Explore through an agent" lands here with the workspace set and composer focused
- A conversation heads with the run's automation, state, 5-hour usage as a percentage and branch, then user and markdown agent bubbles, polled every 3 s while active; Stop kills it, the composer steers it
- Web (700 px and wider) shows the conversation beside the list; mobile opens it as a page with a Back link
- Every chat route follows the theme, so dark mode applies at once
