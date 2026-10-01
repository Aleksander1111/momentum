---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
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
  - docs/designs/chat-mobile.png
  - docs/designs/chats-web.png
---
# Chat screen

Chats per workspace, each a conversation attached to a run; drawn in the light or dark palette picked in Settings.

- Lists chats grouped by workspace, polled every 15 s; each row shows title, kind, status, age and state badges
- A conversation heads with the run's automation, state, 5-hour usage and branch, then its messages as bubbles (user dark, agent as rendered markdown), polled every 3 s while queued or running; Stop kills the run, the composer under it steers it
- The composer under the list starts a new chat run in the chosen workspace; "Explore through an agent" lands here with the composer focused
- Web shows the conversation beside the list; mobile opens it as its own page
