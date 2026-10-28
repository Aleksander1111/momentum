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

How [the scenarios](Testing/TestSuite/end-to-end-scenarios) use the web app in the observer's frame, as the user would, paced.

- Signs in, opens tabs and routes; in Settings toggles a project, opens its row on logo and graph build
- [Feed](Frontend/Screen/feed): swipes the top card to approve, send back, resolve or won't resolve; one not on top goes via the API, or fails when strict
- Asks about a card in the chat below it, or on selected text
- [Chat](Frontend/Screen/chat): starts and replies, Enter; files attached first, via the paperclip or dropped, till uploaded
- Typing sets the field's value plus an input event: Firefox's fill() leaves it empty
- Starts and stops a field's mic to dictate into it
