---
type: Frontend/Screen
origin: requested
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
  - to: Architecture/Component/retrieval-rater
    relation: shows
  - to: Frontend/UiComponent/theme
    relation: uses
  - to: Product/Feature/chat-attachments
    relation: shows
artifacts:
  - apps/app/src/app/(tabs)/chat/index.tsx
  - apps/app/src/app/(tabs)/chat/[runId].tsx
  - apps/app/src/app/(tabs)/chat/_layout.tsx
  - apps/app/src/ui/Composer.tsx
  - apps/app/src/ui/Conversation.tsx
  - apps/app/src/ui/Activity.tsx
---
# Sessions screen

User chats and interviews beside automation runs.

- By workspace under its logo, polled 15 s; rows: starter, title, kind, state, age
- Filter All, Yours, Automations, kept on device; shared project picker
- Composer: Enter sends, Shift+Enter breaks; context and [file](Product/Feature/chat-attachments) chips; unsent says why; mic; bubbles show files
- State in its [colour](Frontend/UiComponent/theme), bold running or failed
- Head: state dot (amber stopping, red ring failed), automation, 5-h usage, entity, Stop
- Per turn: time, tools, tokens, live call, RAG; opens to calls, ratings; polled 2 s while active
- New messages follow the end only while the reader is at it; sending goes back there
- Wide: beside the list, back closes it; else a page
