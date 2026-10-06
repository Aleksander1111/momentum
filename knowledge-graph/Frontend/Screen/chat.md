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

- Grouped by workspace under its logo, polled every 15 s; rows: title, kind, status, age, state
- A project picker, shared with Explorer and Metrics, picks where a new chat goes
- The composer starts a chat run; context card parts wait as chips above it
- A mic beside send shows words as heard, then opens it
- Run head: automation, state (running time), 5-hour usage, the entity the chat is about; Stop turns to Stopping until it ends
- Bubbles polled every 3 s while active; entities an answer names show their glyph, open on a press
- An interview shows the document it writes, takes answers context-free
- Wide: beside the list; narrow: a page
