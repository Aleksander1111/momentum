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

- Breadcrumb: logo, type pill, folders; verification and sync counters
- A card changed since verified shows a diff: −/+ words, marks, diagrams Before/After/Diff
- Linked entities open on a press; only web links open; selections go to chat
- Swipe right approves; left sends back with a comment
- Issue cards add severity, concerns, options, the recommended one picked: right resolves with it; left takes a resolution or a reason not to
- A reaction carries time on card and version; a refused one says why; polls every 15 s, queues offline
- The top card stays until reacted to
- Empty says why: nothing to review, or no project yet
