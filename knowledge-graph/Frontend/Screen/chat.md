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
artifacts:
  - apps/app/src/app/(tabs)/chat/index.tsx
  - apps/app/src/app/(tabs)/chat/[runId].tsx
  - apps/app/src/app/(tabs)/chat/_layout.tsx
  - apps/app/src/ui/Composer.tsx
  - apps/app/src/ui/Conversation.tsx
  - apps/app/src/ui/Activity.tsx
---
# Sessions screen

The user's chats and interviews beside the automations' runs.

- Grouped by workspace under its logo, polled every 15 s; rows: yours/automation icon, title, kind, status, age
- Filter All, Yours, Automations, kept on the device
- A project picker shared with Explorer and Metrics
- Composer: Enter sends, Shift+Enter breaks a line; context as chips; unsent says why; mic dictation
- Run head: automation, state, 5-hour usage, entity; Stop shows Stopping
- Per turn: time, tools, tokens, call under way, RAG score; opens to calls, bookkeeping, tool ratings
- Polled every 2 s while active or a rating is pending (≤3 min)
- Wide: beside the list, back closes it; narrow: a page
