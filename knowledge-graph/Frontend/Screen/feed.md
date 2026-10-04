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

Ranked cards from enabled projects, one at a time

- Breadcrumb: project logo, type pill, folders
- Counters: verification and sync pills with counts
- A card changed since verified shows the diff: −/+ word counts; changed words, rows, items, code lines marked; a diagram as Before/After/Diff
- Selected text, diagram shapes go to chat context
- Swipe right approves; left opens a Disapprove sheet whose comment goes back
- Issue cards add severity, concerns, options: right resolves with the pick; left takes a resolution or won't-resolve reason
- A reaction carries the time on card and the card version: one changed meanwhile is refused and shown again; polls every 15 s; queues offline
