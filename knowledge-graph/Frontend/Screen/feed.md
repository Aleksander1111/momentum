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

Ranked cards from enabled projects, one at a time.

- Breadcrumb: project logo (to Explorer), type pill, folders
- Counters: verification, sync pills, count per state
- A card changed since verified shows the diff: −/+ word counts; changed words, rows, items, code lines marked; a diagram as Before/After/Diff
- Selected text and diagram shapes go to chat context; on web right button selects, left swipes
- Swipe right approves; left opens a Disapprove sheet whose comment goes back
- Issue cards add severity, category, concerns, options: right resolves with the pick; left takes a resolution or won't-resolve reason
- Time on card goes with a reaction; polls every 15 s; reactions queue offline
