---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/consistency-check
    relation: resolves_issues_of
artifacts:
  - apps/app/src/app/(tabs)/feed.tsx
  - apps/app/src/lib/feed.ts
  - apps/app/src/lib/query.ts
  - apps/app/src/ui/CardView.tsx
  - apps/app/src/ui/StateBadge.tsx
  - apps/app/src/ui/Conversation.tsx
kind: page
---
# Feed screen

Ranked cards from included projects, one on top, two behind.

- Breadcrumb: logo, type, folders; verification and sync counters
- Changed since verified: a diff of words, marks, diagrams
- A long card scrolls in itself; tables keep its width
- Links open; a selection or a picked shape opens the card's chat with it, no button
- Swipe right approves; left asks rework in a comment sheet, closed by Android back
- Pulled up at its end, a card opens a chat below it on the whole card; it closes as the card changes or is reacted to
- Issue cards add severity, concerns, options, recommended picked: right resolves with it; left takes a resolution or a reason not to
- A reaction carries time on card; approve and resolve the card's version; polls every 15 s, queues offline
- The top card stays until reacted to
- Empty says why: nothing to review or no project yet
