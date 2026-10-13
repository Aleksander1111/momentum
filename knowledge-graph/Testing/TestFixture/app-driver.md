---
type: Testing/TestFixture
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Testing/TestSuite/end-to-end-scenarios
    relation: used_by
  - to: Frontend/Screen/feed
    relation: concerns
  - to: Frontend/Screen/chat
    relation: concerns
artifacts:
  - apps/backend/e2e/support/app.ts
---
# End-to-end app driver

How [the scenarios](Testing/TestSuite/end-to-end-scenarios) use the web app in the observer's frame, as the user would, each step paced.

- Signs in, opens tabs and routes; Settings toggles included projects
- [Feed](Frontend/Screen/feed): swipes the top card to approve, send back, resolve or won't resolve; one not on top goes through the API, or fails when strict
- Asks about a card in the chat below it, or on a selected text
- [Chat](Frontend/Screen/chat): starts and replies, Ctrl+Enter; files attached first, picked via the paperclip or dropped, till uploaded
- Typing sets the field's value plus an input event: Firefox's fill() leaves it empty to the app
- Holds the mic open for voice
