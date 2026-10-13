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
  - to: Architecture/Component/retrieval-rater
    relation: shows
  - to: Frontend/UiComponent/theme
    relation: uses
artifacts:
  - apps/app/src/app/(tabs)/chat/index.tsx
  - apps/app/src/app/(tabs)/chat/[runId].tsx
  - apps/app/src/app/(tabs)/chat/_layout.tsx
  - apps/app/src/ui/Composer.tsx
  - apps/app/src/ui/Conversation.tsx
  - apps/app/src/ui/Activity.tsx
---
# Sessions screen

The user's chats and interviews beside automation runs.

- By workspace under its logo, polled every 15 s; rows: who started it, title, kind, state, age
- Filter All, Yours, Automations, kept on the device; project picker, shared
- Composer: Enter sends, Shift+Enter breaks; context chips; unsent says why; mic
- State in its [colour](Frontend/UiComponent/theme), bold if running or failed
- Run head: state dot (amber while stopping, red ring if failed), automation, state, 5-h usage, entity; Stop
- Per turn: time, tools, tokens, live call, RAG score; opens to calls, bookkeeping, tool ratings
- Polled 2 s while active or rating (≤3 min)
- Wide: beside the list, back closes it; else a page
