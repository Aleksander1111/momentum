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
kind: page
---
# Feed screen

Ranked cards from included projects, one on top, two behind.

- Breadcrumb: logo, type, folders; verification and sync counters
- Changed since verified: a diff of words, marks, diagrams
- A long card scrolls within itself; tables keep to its width
- Linked entities open; selections go to chat
- Swipe right approves; left sends back with a comment
- Issue cards add severity, concerns, options, the recommended picked: right resolves with it; left takes a resolution or a reason not to
- A reaction carries time on card; approve and resolve carry the card's version; polls every 15 s, queues offline
- The top card stays until reacted to
- Empty says why: nothing to review, or no project yet
