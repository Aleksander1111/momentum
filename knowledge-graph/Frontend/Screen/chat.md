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

- Grouped by workspace under its logo, polled every 15 s; rows: kind, status, age, states
- A project picker, shared with Explorer and Metrics, picks where a new chat goes
- The composer starts a chat run; context card parts wait as chips above it
- A mic beside send shows words as heard, then opens the chat
- A conversation: run head (automation, state, 5-hour usage), bubbles polled every 3 s while active; Stop kills it
- Entities an answer names show their type's glyph, open on a press
- An interview shows the document it writes, takes answers context-free
- Wide: beside the list; narrow: own page, Back to Chats or the opening tab
